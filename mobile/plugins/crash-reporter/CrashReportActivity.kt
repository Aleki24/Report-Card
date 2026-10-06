package __PACKAGE__

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.util.TypedValue
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/** Shows a crash saved by [CrashReporter] with a Copy button. Runs in the ":crash" process. */
class CrashReportActivity : Activity() {
  companion object {
    const val EXTRA_REPORT = "report"
  }

  private lateinit var reportView: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    reportView = TextView(this).apply {
      setTextIsSelectable(true)
      typeface = Typeface.MONOSPACE
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
    }
    val title = TextView(this).apply {
      text = "Skulbase crashed"
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
      setTypeface(typeface, Typeface.BOLD)
    }
    val hint = TextView(this).apply {
      text = "Tap Copy, then paste the text into the chat so the problem can be fixed."
    }
    val buttons = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      addView(Button(this@CrashReportActivity).apply {
        text = "Copy"
        setOnClickListener { copyReport() }
      })
      addView(Button(this@CrashReportActivity).apply {
        text = "Close"
        setOnClickListener { finishAndRemoveTask() }
      })
    }
    val padding = dp(16)
    setContentView(LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      fitsSystemWindows = true
      setPadding(padding, padding, padding, padding)
      addView(title)
      addView(hint)
      addView(buttons)
      addView(ScrollView(this@CrashReportActivity).apply { addView(reportView) }, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
    })
    showReport(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    showReport(intent)
  }

  private fun showReport(intent: Intent?) {
    reportView.text = intent?.getStringExtra(EXTRA_REPORT) ?: "No crash details were saved."
  }

  private fun copyReport() {
    val clipboard = getSystemService(ClipboardManager::class.java) ?: return
    clipboard.setPrimaryClip(ClipData.newPlainText("Skulbase crash report", reportView.text))
    Toast.makeText(this, "Copied", Toast.LENGTH_SHORT).show()
  }

  private fun dp(value: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()
}
