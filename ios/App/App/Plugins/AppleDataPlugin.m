#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AppleDataPlugin, "AppleData",
    CAP_PLUGIN_METHOD(requestRemindersPermission, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestCalendarPermission, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getReminders, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createReminder, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateReminder, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(deleteReminder, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(completeReminder, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getCalendars, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getEvents, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createEvent, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateEvent, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(deleteEvent, CAPPluginReturnPromise);
)
