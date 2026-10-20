# 24Years Android

Kotlin + Jetpack Compose 多模块宿主。产品与分发决策见 [`docs/08_Android官网分发技术实施计划.md`](../docs/08_Android官网分发技术实施计划.md)。

## 孕期本地版（2026-10-20）

已接通建档、首页、产检与关联费用、体征、现金账本、自建提醒、宫缩计时、医疗卡、静默关怀及 JSON 备份恢复。数据保存在本机 Room，无需登录。实际能力与验收边界见 [09 实现与验收](../docs/09_孕期本地版实现与验收.md)。

Windows 可运行 `./verify.ps1` 完成 Debug 构建、领域测试、数据库测试及 Lint。APK 输出在 `app/build/outputs/apk/debug/app-debug.apk`。正式发布签名与真机验收尚待完成。

## 打开工程

用 Android Studio 打开 **`android/`** 目录（不要打开仓库根目录）。首次会生成 `local.properties`（已 gitignore）。

本机若还没有 SDK，可把 `ANDROID_HOME` 指到 SDK 根目录，并安装：

```text
platforms;android-35
build-tools;35.0.0
platform-tools
```

## 模块

- `app`：宿主，组装导航与 Hilt
- `core:*`：无界面内核（`model` / `domain` / `module-runtime` 为纯 JVM）
- `feature:*`：功能界面；互相不依赖，只依赖 `core`

0.1.0 孕期代码编译进宿主。`ModuleRuntime` 对备孕 / 0–1 岁返回未实现。

## 命令

```bash
# 不需要 Android SDK
./gradlew :core:domain:test :core:module-runtime:compileKotlin

# 需要本机 SDK（local.properties 或 ANDROID_HOME）
./gradlew :app:assembleDebug
```

Windows：`gradlew.bat`。
