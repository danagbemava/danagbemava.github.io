---
layout: post
title:  "Debugging an OOM crash in Flutter"
date:   "2023-12-30"
categories: flutter debugging
---

### Background

A couple of months ago I received a report on one of my freelance projects that the app would 
just go black and restart during usage. It was rather strange because we had been testing the app
for quite some time now (it is a long term project) and that was never an issue. So I asked for a 
recording just so I could investigate the phenomenon.

### Gathering suspects

I ran the app several times with my credentials (test account) and I was not able to reproduce the issue 
so I requested for the credentials of the account that was reproducing the issue so that I could investigate. 

When I tested on my device with those same credentials, I could not reproduce it either. I asked my colleague to test
with my test account and it did not reproduce on his device (which had the issue) with my test credentials either. 

At this point, we thought it might be a backend issue, but I ruled it out because the backend was only responsible for 
returning the data, it didn't have any control over what happened within the app. 

I had already setup Sentry for crash reporting but the crash was not showing up in Sentry. 

At this point, all we knew was the crash was only happening on my colleague's device with a specific account. 

We then decided to meet up in person so we could figure out why the crash was happening.

### The Meetup

When I got my hands on the device, I started playing with the app to see what could be happening. 

I discovered that the app crashed only when a specific screen was opened. 

That particular screen was made up of 2 different views that displayed similar content. 

Initially, it didn't make sense as to why that particular screen was causing the crash because that screen, in terms of both design and code, was one of the simplest in the entire application. 

It was then that I was informed that they had recently been updating some images for the client and that is when things started clicking. 

I broke out the flutter devtools and began monitoring the memory usage of the app when that screen was opened, and lo and behold, there was a sharp spike and then BOOM!!!, the app would crash. 

You might wonder why the app was crashing on my colleagues device but not mine and the reason behind that is simple. 
I was testing on a Pixel 7, which has around 8gb ram whereas my colleague was testing on a Samsung Tab which had around 2gb ram. 
When I first touched the device, I *felt* every interaction I had with it (if you know what I mean)

### Mitigation

Now that I knew it was images causing the OOM crash, the next step was to find a way to reduce how much memory the images 
were consuming so that the app would not crash. I was using [cached_network_image](https://pub.dev/packages/cached_network_image) in my project so I looked up some of the properties to see if there was a way to reduce the size. 

The package has these properties `memCacheHeight` and `memCacheWidth`. The dartdoc for these two properties are as follows: 

```dart
/// Will resize the image in memory to have a certain width using [ResizeImage]
final int? memCacheWidth;

/// Will resize the image in memory to have a certain height using [ResizeImage]
final int? memCacheHeight;
```

It turned out to be exactly what I needed. I set a reasonable `memCacheWidth` & `memCacheHeight` for the page we were experiencing the crash on and we run a few tests. 

We started memory profiling as well, and after an initial spike (it wasn't as high this time), the memory usage became steady. The app did not crash!!. 

Btw, the package also has these properties which should be useful for other scenarios

```dart
/// Will resize the image and store the resized image in the disk cache.
final int? maxWidthDiskCache;

/// Will resize the image and store the resized image in the disk cache.
final int? maxHeightDiskCache;
```

### Next Steps

We had other places in your codebase where we would also load up several images, so we decided to apply the memCacheWidth/height properties as well and since then, the app has been stable. I have been encouraging QA to break the app so that we can discover more of these bugs and fix them as well. 

### Aside

Now, you may be wondering why I was not able to catch the crash in either crashlytics or sentry. Well, from what I understand, this is because the flutter engine does not handle OOM well. See [#6500](https://github.com/flutter/flutter/issues/6500
)

### A few takeaways

- The flutter Devtools is your friend, use it
- Profile your app every once in a while
- Don't assume your users will be using the same spec'd devices as you
- Try to test your apps on low end devices to see how it feels 