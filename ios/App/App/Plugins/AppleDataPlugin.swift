import Foundation
import Capacitor
import EventKit

/**
 * AppleDataPlugin
 *
 * Capacitor plugin bridging EventKit for:
 *   - EKReminder  → JS methods: requestRemindersPermission, getReminders, createReminder,
 *                               updateReminder, deleteReminder, completeReminder
 *   - EKEvent     → JS methods: requestCalendarPermission, getCalendars, getEvents,
 *                               createEvent, updateEvent, deleteEvent
 */
@objc(AppleDataPlugin)
public class AppleDataPlugin: CAPPlugin {

    private let store = EKEventStore()

    // ─── Permission helpers ───────────────────────────────────────────────────

    @objc func requestRemindersPermission(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            store.requestFullAccessToReminders { granted, error in
                if let error = error {
                    call.reject("Permission error: \(error.localizedDescription)")
                    return
                }
                call.resolve(["granted": granted])
            }
        } else {
            store.requestAccess(to: .reminder) { granted, error in
                if let error = error {
                    call.reject("Permission error: \(error.localizedDescription)")
                    return
                }
                call.resolve(["granted": granted])
            }
        }
    }

    @objc func requestCalendarPermission(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            store.requestFullAccessToEvents { granted, error in
                if let error = error {
                    call.reject("Permission error: \(error.localizedDescription)")
                    return
                }
                call.resolve(["granted": granted])
            }
        } else {
            store.requestAccess(to: .event) { granted, error in
                if let error = error {
                    call.reject("Permission error: \(error.localizedDescription)")
                    return
                }
                call.resolve(["granted": granted])
            }
        }
    }

    // ─── Reminders ────────────────────────────────────────────────────────────

    @objc func getReminders(_ call: CAPPluginCall) {
        let calendars = store.calendars(for: .reminder)
        let predicate = store.predicateForReminders(in: calendars)

        store.fetchReminders(matching: predicate) { reminders in
            guard let reminders = reminders else {
                call.resolve(["reminders": []])
                return
            }

            let incomplete = reminders.filter { !$0.isCompleted }
            let result = incomplete.map { self.reminderToDict($0) }
            call.resolve(["reminders": result])
        }
    }

    @objc func createReminder(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), !title.isEmpty else {
            call.reject("Missing title")
            return
        }

        let reminder = EKReminder(eventStore: store)
        reminder.title = title
        reminder.notes = call.getString("notes")

        // Due date
        if let dueDateStr = call.getString("dueDate") {
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: dueDateStr) {
                var components = Calendar.current.dateComponents(
                    [.year, .month, .day, .hour, .minute, .second], from: date)
                reminder.dueDateComponents = components
                // Also set an alarm so it appears in Notification Center
                reminder.addAlarm(EKAlarm(absoluteDate: date))
            }
        }

        // Target the default reminders calendar
        reminder.calendar = store.defaultCalendarForNewReminders()

        do {
            try store.save(reminder, commit: true)
            call.resolve(["reminder": self.reminderToDict(reminder)])
        } catch {
            call.reject("Failed to save reminder: \(error.localizedDescription)")
        }
    }

    @objc func updateReminder(_ call: CAPPluginCall) {
        guard let reminderId = call.getString("reminderId") else {
            call.reject("Missing reminderId")
            return
        }

        guard let reminder = store.calendarItem(withIdentifier: reminderId) as? EKReminder else {
            call.reject("Reminder not found: \(reminderId)")
            return
        }

        if let title = call.getString("title") { reminder.title = title }
        if let notes = call.getString("notes") { reminder.notes = notes }
        if let dueDateStr = call.getString("dueDate") {
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: dueDateStr) {
                let components = Calendar.current.dateComponents(
                    [.year, .month, .day, .hour, .minute, .second], from: date)
                reminder.dueDateComponents = components
            }
        }

        do {
            try store.save(reminder, commit: true)
            call.resolve(["reminder": self.reminderToDict(reminder)])
        } catch {
            call.reject("Failed to update reminder: \(error.localizedDescription)")
        }
    }

    @objc func deleteReminder(_ call: CAPPluginCall) {
        guard let reminderId = call.getString("reminderId") else {
            call.reject("Missing reminderId")
            return
        }

        guard let reminder = store.calendarItem(withIdentifier: reminderId) as? EKReminder else {
            // Already gone — treat as success
            call.resolve(["deleted": true])
            return
        }

        do {
            try store.remove(reminder, commit: true)
            call.resolve(["deleted": true])
        } catch {
            call.reject("Failed to delete reminder: \(error.localizedDescription)")
        }
    }

    @objc func completeReminder(_ call: CAPPluginCall) {
        guard let reminderId = call.getString("reminderId") else {
            call.reject("Missing reminderId")
            return
        }

        guard let reminder = store.calendarItem(withIdentifier: reminderId) as? EKReminder else {
            call.reject("Reminder not found: \(reminderId)")
            return
        }

        reminder.isCompleted = true
        reminder.completionDate = Date()

        do {
            try store.save(reminder, commit: true)
            call.resolve(["completed": true])
        } catch {
            call.reject("Failed to complete reminder: \(error.localizedDescription)")
        }
    }

    // ─── Calendars ────────────────────────────────────────────────────────────

    @objc func getCalendars(_ call: CAPPluginCall) {
        let calendars = store.calendars(for: .event)
        let result = calendars.map { cal -> [String: Any] in
            return [
                "id": cal.calendarIdentifier,
                "title": cal.title,
                "color": self.colorToHex(cal.cgColor),
                "isSubscribed": cal.isSubscribed,
                "allowsContentModifications": cal.allowsContentModifications,
            ]
        }
        call.resolve(["calendars": result])
    }

    @objc func getEvents(_ call: CAPPluginCall) {
        guard let startStr = call.getString("startDate"),
              let endStr = call.getString("endDate") else {
            call.reject("Missing startDate or endDate")
            return
        }

        let formatter = ISO8601DateFormatter()
        guard let startDate = formatter.date(from: startStr),
              let endDate = formatter.date(from: endStr) else {
            call.reject("Invalid date format — use ISO8601")
            return
        }

        let calendars = store.calendars(for: .event)
        let predicate = store.predicateForEvents(
            withStart: startDate, end: endDate, calendars: calendars)
        let events = store.events(matching: predicate)
        let result = events.map { self.eventToDict($0) }
        call.resolve(["events": result])
    }

    @objc func createEvent(_ call: CAPPluginCall) {
        guard let title = call.getString("title"),
              let startStr = call.getString("startDate"),
              let endStr = call.getString("endDate") else {
            call.reject("Missing title, startDate, or endDate")
            return
        }

        let formatter = ISO8601DateFormatter()
        guard let startDate = formatter.date(from: startStr),
              let endDate = formatter.date(from: endStr) else {
            call.reject("Invalid date format — use ISO8601")
            return
        }

        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = startDate
        event.endDate = endDate
        event.notes = call.getString("notes")
        event.isAllDay = call.getBool("allDay") ?? false
        event.calendar = store.defaultCalendarForNewEvents

        // Assign to a specific calendar if calendarId is provided
        if let calendarId = call.getString("calendarId"),
           let cal = store.calendar(withIdentifier: calendarId) {
            event.calendar = cal
        }

        do {
            try store.save(event, span: .thisEvent, commit: true)
            call.resolve(["event": self.eventToDict(event)])
        } catch {
            call.reject("Failed to save event: \(error.localizedDescription)")
        }
    }

    @objc func updateEvent(_ call: CAPPluginCall) {
        guard let eventId = call.getString("eventId") else {
            call.reject("Missing eventId")
            return
        }

        guard let event = store.calendarItem(withIdentifier: eventId) as? EKEvent else {
            call.reject("Event not found: \(eventId)")
            return
        }

        let formatter = ISO8601DateFormatter()
        if let title = call.getString("title") { event.title = title }
        if let notes = call.getString("notes") { event.notes = notes }
        if let startStr = call.getString("startDate"),
           let startDate = formatter.date(from: startStr) { event.startDate = startDate }
        if let endStr = call.getString("endDate"),
           let endDate = formatter.date(from: endStr) { event.endDate = endDate }

        do {
            try store.save(event, span: .thisEvent, commit: true)
            call.resolve(["event": self.eventToDict(event)])
        } catch {
            call.reject("Failed to update event: \(error.localizedDescription)")
        }
    }

    @objc func deleteEvent(_ call: CAPPluginCall) {
        guard let eventId = call.getString("eventId") else {
            call.reject("Missing eventId")
            return
        }

        guard let event = store.calendarItem(withIdentifier: eventId) as? EKEvent else {
            call.resolve(["deleted": true]) // Already gone
            return
        }

        do {
            try store.remove(event, span: .thisEvent, commit: true)
            call.resolve(["deleted": true])
        } catch {
            call.reject("Failed to delete event: \(error.localizedDescription)")
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private func reminderToDict(_ reminder: EKReminder) -> [String: Any] {
        var dict: [String: Any] = [
            "id": reminder.calendarItemIdentifier,
            "title": reminder.title ?? "",
            "notes": reminder.notes ?? "",
            "isCompleted": reminder.isCompleted,
            "calendarId": reminder.calendar?.calendarIdentifier ?? "",
            "calendarTitle": reminder.calendar?.title ?? "",
        ]

        if let components = reminder.dueDateComponents,
           let date = Calendar.current.date(from: components) {
            dict["dueDate"] = ISO8601DateFormatter().string(from: date)
        }

        if let completionDate = reminder.completionDate {
            dict["completionDate"] = ISO8601DateFormatter().string(from: completionDate)
        }

        return dict
    }

    private func eventToDict(_ event: EKEvent) -> [String: Any] {
        let formatter = ISO8601DateFormatter()
        return [
            "id": event.eventIdentifier ?? "",
            "title": event.title ?? "",
            "notes": event.notes ?? "",
            "startDate": formatter.string(from: event.startDate),
            "endDate": formatter.string(from: event.endDate),
            "allDay": event.isAllDay,
            "calendarId": event.calendar?.calendarIdentifier ?? "",
            "calendarTitle": event.calendar?.title ?? "",
            "calendarColor": colorToHex(event.calendar?.cgColor),
        ]
    }

    private func colorToHex(_ cgColor: CGColor?) -> String {
        guard let cgColor = cgColor,
              let components = cgColor.components, components.count >= 3 else {
            return "#808080"
        }
        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)
        return String(format: "#%02X%02X%02X", r, g, b)
    }
}
