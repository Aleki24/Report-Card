package __PACKAGE__

import android.app.Activity
import android.app.ActivityManager
import android.app.Application
import android.app.ApplicationExitInfo
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * A release build that crashes on launch closes with nothing to read. This keeps
 * the crash (a Java stack trace, or Android's record of a native crash) and shows
 * it on the next launch in [CrashReportActivity], which runs in its own process so
 * a repeat crash cannot take it down.
 */
object CrashReporter {
  private const val TAG = "CrashReporter"
  private const val JAVA_CRASH_FILE = "crash-reporter-java.txt"
  private const val SHOWN_MARKER_FILE = "crash-reporter-shown.txt"
  private const val CRASH_PROCESS_SUFFIX = ":crash"
  private const val MAX_TRACE_BYTES = 1 shl 20
  private const val MAX_TRACE_LINES = 250
  private const val SECTION_DIVIDER = "\n\n----------\n\n"

  @Volatile private var pendingReport: String? = null

  /** True in the crash-report process, where the app must not start React Native. */
  fun isCrashProcess(): Boolean = processName().endsWith(CRASH_PROCESS_SUFFIX)

  /** Call from Application.attachBaseContext, before anything else can crash. */
  fun install(context: Context) {
    if (isCrashProcess()) return
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        File(context.filesDir, JAVA_CRASH_FILE).writeText(
          "Uncaught exception on thread \"${thread.name}\"\n\n${Log.getStackTraceString(error)}"
        )
      } catch (e: Exception) {
        Log.w(TAG, "Could not save the crash report", e)
      }
      previous?.uncaughtException(thread, error)
    }
    pendingReport = try {
      buildPendingReport(context)
    } catch (e: Exception) {
      Log.w(TAG, "Could not read the previous crash", e)
      null
    }
    launchPending(context)
  }

  /** Opens [CrashReportActivity] if the previous run crashed. Safe to call more than once. */
  fun launchPending(context: Context) {
    val report = pendingReport ?: return
    try {
      context.startActivity(
        Intent(context, CrashReportActivity::class.java)
          .putExtra(CrashReportActivity.EXTRA_REPORT, report)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      // A start from an activity cannot be blocked as a background start, so stop retrying.
      if (context is Activity) pendingReport = null
    } catch (e: Exception) {
      Log.w(TAG, "Could not show the crash report", e)
    }
  }

  private fun buildPendingReport(context: Context): String? {
    val sections = mutableListOf<String>()
    val javaCrash = File(context.filesDir, JAVA_CRASH_FILE)
    if (javaCrash.exists()) {
      sections += javaCrash.readText()
      javaCrash.delete()
    }
    lastUnseenExit(context)?.let { sections += it }
    if (sections.isEmpty()) return null
    return (listOf(deviceSummary()) + sections).joinToString(SECTION_DIVIDER)
  }

  private fun deviceSummary(): String =
    "Skulbase ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\n" +
      "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})\n" +
      "${Build.MANUFACTURER} ${Build.MODEL}, ABIs: ${Build.SUPPORTED_ABIS.joinToString()}"

  /** Android's record (API 30+) of why the app's main process last died, if not shown yet. */
  private fun lastUnseenExit(context: Context): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
    val activityManager = context.getSystemService(ActivityManager::class.java) ?: return null
    val exit = activityManager
      .getHistoricalProcessExitReasons(context.packageName, 0, 5)
      .firstOrNull { it.processName == context.packageName } ?: return null
    val label = when (exit.reason) {
      ApplicationExitInfo.REASON_CRASH -> "Java crash"
      ApplicationExitInfo.REASON_CRASH_NATIVE -> "Native crash"
      ApplicationExitInfo.REASON_ANR -> "App not responding"
      ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "Initialization failure"
      else -> return null
    }
    val marker = File(context.filesDir, SHOWN_MARKER_FILE)
    val shownUpTo = try {
      marker.readText().trim().toLong()
    } catch (e: Exception) {
      0L
    }
    if (exit.timestamp <= shownUpTo) return null
    marker.writeText(exit.timestamp.toString())

    val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(exit.timestamp))
    val trace = try {
      exit.traceInputStream?.let { printableLines(readCapped(it)).take(MAX_TRACE_LINES) }
    } catch (e: Exception) {
      null
    }
    return buildString {
      append("$label at $time (status ${exit.status})\n")
      exit.description?.let { append("Description: $it\n") }
      if (!trace.isNullOrEmpty()) append("\nTrace:\n").append(trace.joinToString("\n"))
    }
  }

  private fun readCapped(stream: InputStream): ByteArray = stream.use { input ->
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (out.size() < MAX_TRACE_BYTES) {
      val read = input.read(buffer)
      if (read < 0) break
      out.write(buffer, 0, read)
    }
    out.toByteArray()
  }

  /** Native crash records are binary (a tombstone); keep their readable text runs. */
  private fun printableLines(bytes: ByteArray): List<String> {
    val lines = mutableListOf<String>()
    val current = StringBuilder()
    fun flush() {
      if (current.length >= 4) lines += current.toString()
      current.setLength(0)
    }
    for (byte in bytes) {
      val code = byte.toInt() and 0xFF
      if (code in 0x20..0x7E) current.append(code.toChar()) else flush()
    }
    flush()
    return lines
  }

  private fun processName(): String =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      Application.getProcessName()
    } else {
      try {
        File("/proc/self/cmdline").readText().trimEnd('\u0000')
      } catch (e: Exception) {
        ""
      }
    }
}
