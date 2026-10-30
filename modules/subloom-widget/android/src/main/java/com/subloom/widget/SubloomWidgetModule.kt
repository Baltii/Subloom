package com.subloom.widget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class SubloomWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SubloomWidget")
    AsyncFunction("replace") { value: String ->
      require(value.toByteArray().size <= 131072) { "Widget data is too large" }
      require(JSONObject(value).getInt("version") == 1) { "Unsupported widget data" }
      val context = requireNotNull(appContext.reactContext)
      // Synchronous durable replacement before refreshing the launcher process.
      check(context.getSharedPreferences("subloom.widget", 0).edit().putString("snapshot", value).commit())
      ReminderWidget.updateAll(context)
    }
  }
}
