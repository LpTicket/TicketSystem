#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LPTicketTapToPayEducation, NSObject)

RCT_EXTERN_METHOD(presentPaymentEducation:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
