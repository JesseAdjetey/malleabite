package com.malleabite.app

import android.content.Intent
import android.provider.AlarmClock
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Clock")
class ClockPlugin : Plugin() {

    /**
     * Opens the Android Clock app with a pre-filled alarm.
     *
     * Expected call data:
     *   hour      (Int)     — 0–23
     *   minutes   (Int)     — 0–59
     *   message   (String?) — alarm label
     *   vibrate   (Boolean) — default true
     */
    @PluginMethod
    fun setAlarm(call: PluginCall) {
        val hour = call.getInt("hour") ?: run {
            call.reject("Missing required parameter: hour")
            return
        }
        val minutes = call.getInt("minutes") ?: run {
            call.reject("Missing required parameter: minutes")
            return
        }
        val message = call.getString("message", "")
        val vibrate = call.getBoolean("vibrate", true) ?: true

        val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
            putExtra(AlarmClock.EXTRA_HOUR, hour)
            putExtra(AlarmClock.EXTRA_MINUTES, minutes)
            if (!message.isNullOrEmpty()) putExtra(AlarmClock.EXTRA_MESSAGE, message)
            putExtra(AlarmClock.EXTRA_VIBRATE, vibrate)
            // Don't show the confirmation UI — set silently
            putExtra(AlarmClock.EXTRA_SKIP_UI, false)
        }

        try {
            context.startActivity(intent)
            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to open Clock app: ${e.message}")
        }
    }

    /**
     * Opens the Android Clock app timer screen with a pre-filled countdown.
     *
     * Expected call data:
     *   seconds   (Int)     — total seconds for the timer
     *   message   (String?) — timer label
     */
    @PluginMethod
    fun setTimer(call: PluginCall) {
        val seconds = call.getInt("seconds") ?: run {
            call.reject("Missing required parameter: seconds")
            return
        }
        val message = call.getString("message", "")

        val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
            putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            if (!message.isNullOrEmpty()) putExtra(AlarmClock.EXTRA_MESSAGE, message)
            putExtra(AlarmClock.EXTRA_SKIP_UI, false)
        }

        try {
            context.startActivity(intent)
            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to open Clock app timer: ${e.message}")
        }
    }
}
