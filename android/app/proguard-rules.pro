# TeamSpace Proguard / R8 Rules
-keepattributes *Annotation*
-keep class com.teamspace.app.MainActivity$WebAppInterface { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
