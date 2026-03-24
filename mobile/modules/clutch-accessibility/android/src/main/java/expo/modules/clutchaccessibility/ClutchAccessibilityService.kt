package expo.modules.clutchaccessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class ClutchAccessibilityService : AccessibilityService() {

    companion object {
        var instance: ClutchAccessibilityService? = null
        var lastCapture: ScreenCapture? = null
        val listeners = mutableListOf<(ScreenCapture) -> Unit>()
    }

    data class ScreenCapture(
        val packageName: String,
        val appName: String,
        val text: String,
        val timestamp: Long = System.currentTimeMillis()
    )

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                    AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 300
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val pkg = event.packageName?.toString() ?: return

        // Never capture our own app
        if (pkg == applicationContext.packageName) return

        // Only capture apps the user cares about
        val appName = resolveAppName(pkg) ?: return

        val text = extractText(rootInActiveWindow).trim()
        if (text.length < 10) return // skip empty/tiny screens

        val capture = ScreenCapture(
            packageName = pkg,
            appName = appName,
            text = text.take(2000) // cap at 2000 chars to avoid token bloat
        )

        lastCapture = capture
        listeners.toList().forEach { it(capture) }
    }

    private fun extractText(node: AccessibilityNodeInfo?): String {
        if (node == null) return ""
        val sb = StringBuilder()
        if (!node.text.isNullOrBlank()) {
            sb.append(node.text).append(" ")
        }
        if (!node.contentDescription.isNullOrBlank()) {
            sb.append(node.contentDescription).append(" ")
        }
        for (i in 0 until node.childCount) {
            sb.append(extractText(node.getChild(i)))
        }
        return sb.toString()
    }

    private fun resolveAppName(pkg: String): String? = when {
        pkg.contains("groww") -> "Groww"
        pkg.contains("zerodha") || pkg.contains("kite") -> "Zerodha"
        pkg.contains("angelbroking") || pkg.contains("angel") -> "Angel One"
        pkg.contains("gmail") -> "Gmail"
        pkg.contains("phonepe") -> "PhonePe"
        pkg.contains("paytm") -> "Paytm"
        pkg.contains("whatsapp") -> "WhatsApp"
        pkg.contains("hdfc") -> "HDFC Bank"
        pkg.contains("sbi") -> "SBI"
        pkg.contains("icici") -> "ICICI Bank"
        pkg.contains("axisbank") -> "Axis Bank"
        pkg.contains("kotak") -> "Kotak Bank"
        else -> null // ignore unknown apps
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
