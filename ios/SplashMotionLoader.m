#import <Foundation/Foundation.h>

// Runs automatically when the binary loads, before main(). Looks the Swift
// installer up by name so no generated Swift header import is needed.
@interface SplashMotionLoader : NSObject
@end

@implementation SplashMotionLoader

+ (void)load {
  Class installer = NSClassFromString(@"SplashMotionInstaller");
  SEL install = NSSelectorFromString(@"install");
  if (installer != nil && [installer respondsToSelector:install]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    [installer performSelector:install];
#pragma clang diagnostic pop
  }
}

@end
