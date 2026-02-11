---
layout: post
title:  "Building the flutter engine locally"
date:   "2024-11-27"
categories: flutter engine local
---

This is not an official guide (you can find that in the docs on the flutter engine repo). This is more like steps I used 
so that I can refer to it later. 

### Steps to get the engine

- Get the chrome depot_tools (See https://commondatastorage.googleapis.com/chrome-infra-docs/flat/depot_tools/docs/html/depot_tools_tutorial.html#_setting_up)
- Add the depot_tools to your $PATH (at the front)
- Clone the flutter engine (make sure you have a fast internet connection)
- Create a directory for the engine and cd into that directory
- Run `fetch flutter` in the engine directory
- Rename the remote with this command `git -C src/flutter remote rename origin upstream`
- Run `gclient sync` (gclient is part of the chrome depot_tools)

### Building the engine

Let's say you've made some changes to the engine and you want to test them. 
You can use the following steps to test the changes 

- Compile the engine for the platform you're currently running on (either macOS, linux, windows)
- To compile the engine, make sure you're in the `src/flutter` directory in the engine directory
- Then run `./flutter/tools/gn --unoptimized` (--unoptimized) is optional 
    - If you run it without --unoptimized, you get a host_debug directory
    - If you run it with --unoptimized, you get a host_debug_unopt directory
- Then run `ninja -C out/<host_debug_unopt/host_unopt>` depending on which command you run

```
    nexus@Mac src % ./flutter/tools/gn 
    Using prebuilt Dart SDK binary. If you are editing Dart sources and wish to compile the Dart SDK, set `--no-prebuilt-dart-sdk`.
    Generating GN files in: out/host_debug
    Generating Xcode projects took 205ms
    Generating compile_commands took 77ms
    Done. Made 1551 targets from 407 files in 822ms
```

```

```

Similarly, if you run to build the engine for a platform, like iOS, you can run 

```
./flutter/tools/gn --ios <--simulator> <--unoptimized> 
```

Then run 

```
ninja -C out/<directory_generated_by_command_above>
```

To run flutter with the local engine you just built, follow the following steps 

- Make sure the channel of flutter installed on your device is the same channel/tag that you cloned
  This means if you're on the stable channel, make sure you're using the stable tag of the engine otherwise you might get incompatibilities with dependencies and missing classes/implementations

- Run the app with the following command 
`flutter run --local-engine=ios_debug_sim_unopt --local-engine-src-path=/Users/nexus/projects/flutter_engine/engine/src --local-engine-host=host_debug_unopt`

The `--local-engine-host` & `--local-engine` values depend on what you're trying to build for