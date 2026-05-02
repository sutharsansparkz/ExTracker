package com.extracker.sms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.CopyOnWriteArrayList

class SmsBridgeModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val allowedSenders = CopyOnWriteArrayList<String>()
  private var smsReceiver: BroadcastReceiver? = null

  override fun getName(): String = "SmsBridge"

  @ReactMethod
  fun setAllowedSenders(senders: ReadableArray) {
    val normalized = mutableListOf<String>()
    for (i in 0 until senders.size()) {
      val value = senders.getString(i)
      val normalizedSender = normalizeSender(value)
      if (normalizedSender.isNotEmpty()) {
        normalized.add(normalizedSender)
      }
    }

    allowedSenders.clear()
    allowedSenders.addAll(normalized)
  }

  @ReactMethod
  fun getFilteredMessages(promise: Promise) {
    if (!hasAllSmsPermissions()) {
      requestSmsPermissions()
      promise.reject("E_SMS_PERMISSION", "READ_SMS and RECEIVE_SMS permissions are required")
      return
    }

    try {
      val uri = Uri.parse("content://sms/inbox")
      val projection = arrayOf("_id", "address", "body", "date")
      val result = Arguments.createArray()

      reactContext.contentResolver.query(uri, projection, null, null, "date DESC")?.use { cursor ->
        val idIndex = cursor.getColumnIndex("_id")
        val addressIndex = cursor.getColumnIndex("address")
        val bodyIndex = cursor.getColumnIndex("body")
        val dateIndex = cursor.getColumnIndex("date")

        while (cursor.moveToNext()) {
          val rawSender = if (addressIndex >= 0) cursor.getString(addressIndex) else ""
          if (!isSenderAllowed(rawSender)) {
            continue
          }

          val id = if (idIndex >= 0) cursor.getString(idIndex) else ""
          val body = if (bodyIndex >= 0) (cursor.getString(bodyIndex) ?: "") else ""
          val timestamp = if (dateIndex >= 0) cursor.getLong(dateIndex) else 0L

          result.pushMap(
            createMessageMap(
              id = id,
              sender = rawSender ?: "",
              body = body,
              timestamp = timestamp,
            ),
          )
        }
      }

      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("E_SMS_READ", e)
    }
  }

  @ReactMethod
  fun startListening() {
    if (!hasAllSmsPermissions()) {
      requestSmsPermissions()
      return
    }

    if (smsReceiver != null) {
      return
    }

    smsReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
          return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        for (message in messages) {
          val sender = message.displayOriginatingAddress ?: ""
          if (!isSenderAllowed(sender)) {
            continue
          }

          val body = message.displayMessageBody ?: ""
          val timestamp = message.timestampMillis
          val messageId = "${timestamp}_${normalizeSender(sender).hashCode()}"

          emitNewSms(
            createMessageMap(
              id = messageId,
              sender = sender,
              body = body,
              timestamp = timestamp,
            ),
          )
        }
      }
    }

    val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      reactContext.registerReceiver(smsReceiver, filter)
    }
  }

  override fun invalidate() {
    super.invalidate()
    if (smsReceiver != null) {
      try {
        reactContext.unregisterReceiver(smsReceiver)
      } catch (_: IllegalArgumentException) {
      }
      smsReceiver = null
    }
  }

  private fun emitNewSms(payload: WritableMap) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onNewSms", payload)
  }

  private fun createMessageMap(
    id: String,
    sender: String,
    body: String,
    timestamp: Long,
  ): WritableMap {
    return Arguments.createMap().apply {
      putString("id", id)
      putString("sender", sender)
      putString("body", body)
      putDouble("timestamp", timestamp.toDouble())
    }
  }

  private fun normalizeSender(sender: String?): String {
    return sender.orEmpty().trim().uppercase()
  }

  private fun isSenderAllowed(sender: String?): Boolean {
    val normalizedSender = normalizeSender(sender)
    if (normalizedSender.isEmpty() || allowedSenders.isEmpty()) {
      return false
    }

    return allowedSenders.any { allowed -> normalizedSender.contains(allowed) }
  }

  private fun hasAllSmsPermissions(): Boolean {
    val readGranted =
      reactContext.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    val receiveGranted =
      reactContext.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
    return readGranted && receiveGranted
  }

  private fun requestSmsPermissions() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return
    }

    val activity = currentActivity ?: return
    activity.requestPermissions(
      arrayOf(Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS),
      SMS_PERMISSION_REQUEST_CODE,
    )
  }

  companion object {
    private const val SMS_PERMISSION_REQUEST_CODE = 21011
  }
}