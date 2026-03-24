package expo.modules.clutchaccessibility

import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class ClutchAccessibilityModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("ClutchAccessibility")

        // Check if accessibility service is enabled
        AsyncFunction("isEnabled") { promise: Promise ->
            promise.resolve(isServiceEnabled())
        }

        // Open Android accessibility settings screen
        AsyncFunction("openSettings") { promise: Promise ->
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            appContext.reactContext?.startActivity(intent)
            promise.resolve(null)
        }

        // Get most recently captured screen data
        AsyncFunction("getLastCapture") { promise: Promise ->
            val capture = ClutchAccessibilityService.lastCapture
            if (capture == null) {
                promise.resolve(null)
                return@AsyncFunction
            }
            promise.resolve(mapOf(
                "packageName" to capture.packageName,
                "appName" to capture.appName,
                "text" to capture.text,
                "timestamp" to capture.timestamp
            ))
        }

        // Listen for new screen captures (event emitter)
        Events("onScreenCapture")

        OnStartObserving {
            ClutchAccessibilityService.listeners.add(captureListener)
        }

        OnStopObserving {
            ClutchAccessibilityService.listeners.remove(captureListener)
        }
    }

    private val captureListener: (ClutchAccessibilityService.ScreenCapture) -> Unit = { capture ->
        sendEvent("onScreenCapture", mapOf(
            "packageName" to capture.packageName,
            "appName" to capture.appName,
            "text" to capture.text,
            "timestamp" to capture.timestamp
        ))
    }

    private fun isServiceEnabled(): Boolean {
        val context = appContext.reactContext ?: return false
        val serviceName = "${context.packageName}/${ClutchAccessibilityService::class.java.name}"
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return TextUtils.SimpleStringSplitter(':').apply { setString(enabled) }
            .any { it.equals(serviceName, ignoreCase = true) }
    }
}
