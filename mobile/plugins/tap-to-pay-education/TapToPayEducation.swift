import Foundation
import ProximityReader
import UIKit

@objc(LPTicketTapToPayEducation)
final class LPTicketTapToPayEducation: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc(presentPaymentEducation:rejecter:)
  func presentPaymentEducation(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 18.0, *) else {
      reject("unsupported_ios", "Tap to Pay en iPhone requiere iOS 18 o posterior.", nil)
      return
    }

    DispatchQueue.main.async {
      guard let controller = Self.visibleViewController() else {
        reject("presentation_unavailable", "No se pudo abrir la educación de Tap to Pay.", nil)
        return
      }
      Task { @MainActor in
        do {
          let discovery = ProximityReaderDiscovery()
          let content = try await discovery.content(for: .payment(.howToTap))
          try await discovery.presentContent(content, from: controller)
          resolve(nil)
        } catch {
          reject("education_failed", error.localizedDescription, error)
        }
      }
    }
  }

  private static func visibleViewController(from controller: UIViewController? = UIApplication.shared.connectedScenes
    .compactMap { ($0 as? UIWindowScene)?.keyWindow }
    .first?.rootViewController) -> UIViewController? {
    if let navigation = controller as? UINavigationController { return visibleViewController(from: navigation.visibleViewController) }
    if let tab = controller as? UITabBarController { return visibleViewController(from: tab.selectedViewController) }
    if let presented = controller?.presentedViewController { return visibleViewController(from: presented) }
    return controller
  }
}
