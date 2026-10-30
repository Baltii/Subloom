package com.subloom.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import android.view.View
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.TimeZone
import java.util.Locale

class ReminderWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { update(context, manager, it) }
  }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action != AppWidgetManager.ACTION_APPWIDGET_UPDATE) updateAll(context)
  }
  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      manager.getAppWidgetIds(ComponentName(context, ReminderWidget::class.java)).forEach { update(context, manager, it) }
    }
    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
      val views = RemoteViews(context.packageName, R.layout.subloom_reminder_widget)
      var name = "Subloom"
      var detail = "Open Subloom to refresh your reminders"
      var eventDate = ""
      var countdown = ""
      var trial = false
      var amount = ""
      var path = "/"
      try {
        val data = JSONObject(context.getSharedPreferences("subloom.widget", 0).getString("snapshot", "{}") ?: "{}")
        val now = System.currentTimeMillis()
        if (data.getInt("version") == 1 && data.getLong("expiresAt") > now) {
          when (data.getString("mode")) {
            "private" -> detail = "Details hidden · Open Subloom"
            "setup" -> detail = "Open Subloom to get started"
            "ready" -> {
              val entries = data.getJSONArray("entries")
              var entry: JSONObject? = null
              for (index in 0 until entries.length()) {
                val candidate = entries.getJSONObject(index)
                if (candidate.getLong("from") <= now) entry = candidate
              }
              entry?.let {
                name = it.getString("name")
                path = it.getString("path")
                val date = it.getString("date")
                if (date.isEmpty()) detail = it.getString("label")
                else {
                  // Compare date-only values in UTC; timezone formatting selects
                  // the workspace's today without dividing DST-length days.
                  val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC"); isLenient = false }
                  val workspaceDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone(data.getString("timezone")) }.format(Date(now))
                  val due = requireNotNull(parser.parse(date))
                  val days = (due.time - requireNotNull(parser.parse(workspaceDate)).time) / 86400000L
                  val relative = when (days) { 0L -> "Today"; 1L -> "Tomorrow"; else -> "In $days days" }
                  val formatted = SimpleDateFormat("MMM d", Locale.getDefault()).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(due)
                  detail = it.getString("label")
                  eventDate = formatted
                  countdown = relative
                  trial = detail == "Trial ends"
                  amount = it.getString("amount")
                }
              }
            }
          }
        }
      } catch (_: Exception) { /* Missing/corrupt cache: offer to open Subloom. */ }
      views.setTextViewText(R.id.subloom_widget_name, name)
      views.setTextViewText(R.id.subloom_widget_event, detail)
      views.setTextViewText(R.id.subloom_widget_amount, amount)
      views.setTextViewText(R.id.subloom_widget_date, eventDate)
      views.setTextViewText(R.id.subloom_widget_countdown, countdown)
      views.setViewVisibility(R.id.subloom_widget_date, if (eventDate.isEmpty()) View.GONE else View.VISIBLE)
      views.setViewVisibility(R.id.subloom_widget_countdown, if (countdown.isEmpty()) View.GONE else View.VISIBLE)
      views.setTextColor(R.id.subloom_widget_countdown, context.getColor(if (trial) R.color.subloom_widget_trial else R.color.subloom_widget_accent))
      val uri = Uri.Builder().scheme("subloom").authority("open").appendQueryParameter("path", path).build()
      val intent = Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      views.setOnClickPendingIntent(R.id.subloom_widget_root, PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      views.setContentDescription(R.id.subloom_widget_root, listOf(name, detail, eventDate, countdown, amount).filter { it.isNotEmpty() }.joinToString(". "))
      manager.updateAppWidget(id, views)
    }
  }
}
