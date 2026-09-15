# 24Years Android

Kotlin + Jetpack Compose 多模块宿主。产品与分发决策见 [`docs/08_Android官网分发技术实施计划.md`](../docs/08_Android官网分发技术实施计划.md)。

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
