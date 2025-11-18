/**
 * Tests for Support Mode with Product Page Detection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSupportMode, shouldShowTrackingButton } from "./supportMode";

// Mock the dependencies
vi.mock("../adapters/registry", () => ({
  getTierInfo: vi.fn(),
}));

vi.mock("../utils/ecommerceDetector", () => ({
  isLikelyEcommerceSite: vi.fn(),
}));

vi.mock("../utils/productPageDetector", () => ({
  isProductPage: vi.fn(),
  isProductPageForSite: vi.fn(),
}));

describe("Support Mode with Product Page Detection", () => {
  let mockDocument: Document;
  let mockGetTierInfo: ReturnType<typeof vi.fn>;
  let mockIsLikelyEcommerceSite: ReturnType<typeof vi.fn>;
  let mockIsProductPage: ReturnType<typeof vi.fn>;
  let mockIsProductPageForSite: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Create a simple mock document
    mockDocument = {
      body: { textContent: "" },
    } as Document;

    // Import mocked modules
    const { getTierInfo } = vi.mocked(await import("../adapters/registry"));
    const { isLikelyEcommerceSite } = vi.mocked(
      await import("../utils/ecommerceDetector")
    );
    const { isProductPage, isProductPageForSite } = vi.mocked(
      await import("../utils/productPageDetector")
    );

    mockGetTierInfo = getTierInfo;
    mockIsLikelyEcommerceSite = isLikelyEcommerceSite;
    mockIsProductPage = isProductPage;
    mockIsProductPageForSite = isProductPageForSite;

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe("resolveSupportMode", () => {
    it("should return specific tier for product pages on specific sites", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "specific",
        siteName: "Amazon",
        adapterName: "amazon",
      });
      mockIsProductPageForSite.mockReturnValue(true);

      const result = resolveSupportMode(
        "https://www.amazon.es/dp/B123",
        mockDocument
      );
      expect(result).toBe("specific");
      expect(mockIsProductPageForSite).toHaveBeenCalledWith(
        "https://www.amazon.es/dp/B123",
        "amazon"
      );
    });

    it("should return none for non-product pages on specific sites", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "specific",
        siteName: "Amazon",
        adapterName: "amazon",
      });
      mockIsProductPageForSite.mockReturnValue(false);

      const result = resolveSupportMode("https://www.amazon.es/", mockDocument);
      expect(result).toBe("none");
      expect(mockIsProductPageForSite).toHaveBeenCalledWith(
        "https://www.amazon.es/",
        "amazon"
      );
    });

    it("should return whitelist tier for product pages on whitelist sites", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "whitelist",
        siteName: "Etsy",
        adapterName: "enhanced-generic",
      });
      mockIsProductPageForSite.mockReturnValue(true);

      const result = resolveSupportMode(
        "https://www.etsy.com/listing/123",
        mockDocument
      );
      expect(result).toBe("whitelist");
    });

    it("should return none for non-product pages on whitelist sites", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "whitelist",
        siteName: "Etsy",
        adapterName: "enhanced-generic",
      });
      mockIsProductPageForSite.mockReturnValue(false);

      const result = resolveSupportMode("https://www.etsy.com/", mockDocument);
      expect(result).toBe("none");
    });

    it("should return manual tier for product pages on manual sites", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "manual",
        siteName: "unknown-store.com",
        adapterName: "generic",
      });
      mockIsLikelyEcommerceSite.mockReturnValue(true);
      mockIsProductPage.mockReturnValue(true);

      const result = resolveSupportMode(
        "https://unknown-store.com/product/123",
        mockDocument
      );
      expect(result).toBe("manual");
    });

    it("should return none for non-ecommerce sites on manual tier", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "manual",
        siteName: "unknown-store.com",
        adapterName: "generic",
      });
      mockIsLikelyEcommerceSite.mockReturnValue(false);

      const result = resolveSupportMode(
        "https://unknown-store.com/",
        mockDocument
      );
      expect(result).toBe("none");
      expect(mockIsProductPage).not.toHaveBeenCalled();
    });

    it("should return none for non-product pages on manual tier", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "manual",
        siteName: "unknown-store.com",
        adapterName: "generic",
      });
      mockIsLikelyEcommerceSite.mockReturnValue(true);
      mockIsProductPage.mockReturnValue(false);

      const result = resolveSupportMode(
        "https://unknown-store.com/",
        mockDocument
      );
      expect(result).toBe("none");
    });

    it("should return none tier for unsupported sites", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "none",
        siteName: null,
        adapterName: null,
      });

      const result = resolveSupportMode(
        "https://unsupported-site.com/",
        mockDocument
      );
      expect(result).toBe("none");
      expect(mockIsProductPageForSite).not.toHaveBeenCalled();
      expect(mockIsLikelyEcommerceSite).not.toHaveBeenCalled();
      expect(mockIsProductPage).not.toHaveBeenCalled();
    });
  });

  describe("shouldShowTrackingButton", () => {
    it("should return true for specific tier on product pages", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "specific",
        siteName: "Amazon",
        adapterName: "amazon",
      });
      mockIsProductPageForSite.mockReturnValue(true);

      const result = shouldShowTrackingButton(
        "https://www.amazon.es/dp/B123",
        mockDocument
      );
      expect(result).toBe(true);
    });

    it("should return false for specific tier on non-product pages", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "specific",
        siteName: "Amazon",
        adapterName: "amazon",
      });
      mockIsProductPageForSite.mockReturnValue(false);

      const result = shouldShowTrackingButton(
        "https://www.amazon.es/",
        mockDocument
      );
      expect(result).toBe(false);
    });

    it("should return true for whitelist tier on product pages", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "whitelist",
        siteName: "Etsy",
        adapterName: "enhanced-generic",
      });
      mockIsProductPageForSite.mockReturnValue(true);

      const result = shouldShowTrackingButton(
        "https://www.etsy.com/listing/123",
        mockDocument
      );
      expect(result).toBe(true);
    });

    it("should return false for whitelist tier on non-product pages", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "whitelist",
        siteName: "Etsy",
        adapterName: "enhanced-generic",
      });
      mockIsProductPageForSite.mockReturnValue(false);

      const result = shouldShowTrackingButton(
        "https://www.etsy.com/",
        mockDocument
      );
      expect(result).toBe(false);
    });

    it("should return true for manual tier on product pages", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "manual",
        siteName: "unknown-store.com",
        adapterName: "generic",
      });
      mockIsLikelyEcommerceSite.mockReturnValue(true);
      mockIsProductPage.mockReturnValue(true);

      const result = shouldShowTrackingButton(
        "https://unknown-store.com/product/123",
        mockDocument
      );
      expect(result).toBe(true);
    });

    it("should return false for manual tier on non-ecommerce sites", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "manual",
        siteName: "unknown-store.com",
        adapterName: "generic",
      });
      mockIsLikelyEcommerceSite.mockReturnValue(false);

      const result = shouldShowTrackingButton(
        "https://unknown-store.com/",
        mockDocument
      );
      expect(result).toBe(false);
    });

    it("should return false for none tier", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "none",
        siteName: null,
        adapterName: null,
      });

      const result = shouldShowTrackingButton(
        "https://unsupported-site.com/",
        mockDocument
      );
      expect(result).toBe(false);
    });
  });

  describe("Real-world examples", () => {
    it("should handle Amazon product pages correctly", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "specific",
        siteName: "Amazon",
        adapterName: "amazon",
      });
      mockIsProductPageForSite.mockImplementation(
        (url: string, site: string) => {
          return site === "amazon" && url.includes("/dp/");
        }
      );

      // Product page - should show button
      expect(
        shouldShowTrackingButton(
          "https://www.amazon.es/Kiby-Certificado/dp/B0CFY9Q9TB/",
          mockDocument
        )
      ).toBe(true);

      // Non-product page - should not show button
      expect(
        shouldShowTrackingButton("https://www.amazon.es/", mockDocument)
      ).toBe(false);
      expect(
        shouldShowTrackingButton(
          "https://www.amazon.es/gp/your-account/order-history",
          mockDocument
        )
      ).toBe(false);
    });

    it("should handle eBay product pages correctly", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "specific",
        siteName: "eBay",
        adapterName: "ebay",
      });
      mockIsProductPageForSite.mockImplementation(
        (url: string, site: string) => {
          return site === "ebay" && url.includes("/itm/");
        }
      );

      // Product page - should show button
      expect(
        shouldShowTrackingButton(
          "https://www.ebay.es/itm/123456789",
          mockDocument
        )
      ).toBe(true);

      // Non-product page - should not show button
      expect(
        shouldShowTrackingButton("https://www.ebay.es/", mockDocument)
      ).toBe(false);
      expect(
        shouldShowTrackingButton("https://www.ebay.es/cart", mockDocument)
      ).toBe(false);
    });

    it("should handle unknown store product pages correctly", () => {
      mockGetTierInfo.mockReturnValue({
        tier: "manual",
        siteName: "unknown-store.com",
        adapterName: "generic",
      });
      mockIsLikelyEcommerceSite.mockReturnValue(true);
      mockIsProductPage.mockImplementation((url: string) => {
        return url.includes("/product/") || url.includes("/item/");
      });

      // Product page - should show button
      expect(
        shouldShowTrackingButton(
          "https://unknown-store.com/product/laptop",
          mockDocument
        )
      ).toBe(true);

      // Non-product page - should not show button
      expect(
        shouldShowTrackingButton("https://unknown-store.com/", mockDocument)
      ).toBe(false);
      expect(
        shouldShowTrackingButton("https://unknown-store.com/cart", mockDocument)
      ).toBe(false);
    });
  });
});
