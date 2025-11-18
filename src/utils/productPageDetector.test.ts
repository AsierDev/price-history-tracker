/**
 * Tests for Product Page Detector
 */

import { describe, it, expect } from "vitest";
import {
  isProductPage,
  isProductPageForSite,
  getProductPageExplanation,
} from "./productPageDetector";

describe("Product Page Detector", () => {
  describe("isProductPage", () => {
    it("should detect Amazon product pages", () => {
      expect(
        isProductPage(
          "https://www.amazon.es/Kiby-Certificado-Oeko-Tex%C2%AE-CERTIPURTM-Plegable/dp/B0CFY9Q9TB/"
        )
      ).toBe(true);
      expect(
        isProductPage(
          "https://www.amazon.com/Bonka-tostado-natural-superior-Espresso/dp/B0D1CST2K3/"
        )
      ).toBe(true);
    });

    it("should reject Amazon non-product pages", () => {
      expect(isProductPage("https://www.amazon.es/")).toBe(false);
      expect(
        isProductPage(
          "https://www.amazon.es/gp/your-account/order-history?ref_=ya_d_c_yo"
        )
      ).toBe(false);
      expect(
        isProductPage(
          "https://www.amazon.es/cpe/yourpayments/wallet?ref_=ya_d_c_pmt_mpo"
        )
      ).toBe(false);
      expect(isProductPage("https://www.amazon.es/gp/cart")).toBe(false);
      expect(
        isProductPage("https://www.amazon.es/s?k=laptop&ref=nb_sb_noss")
      ).toBe(false);
    });

    it("should detect eBay product pages", () => {
      expect(isProductPage("https://www.ebay.es/itm/123456789")).toBe(true);
      expect(
        isProductPage("https://www.ebay.com/itm/laptop-gaming/123456")
      ).toBe(true);
    });

    it("should reject eBay non-product pages", () => {
      expect(isProductPage("https://www.ebay.es/")).toBe(false);
      expect(isProductPage("https://www.ebay.es/mye/")).toBe(false);
      expect(isProductPage("https://www.ebay.es/cart/")).toBe(false);
      expect(isProductPage("https://www.ebay.es/sch/i.html?_nkw=laptop")).toBe(
        false
      );
    });

    it("should detect AliExpress product pages", () => {
      expect(
        isProductPage("https://www.aliexpress.com/item/123456789.html")
      ).toBe(true);
      expect(
        isProductPage("https://www.aliexpress.es/item/producto-test/123456")
      ).toBe(true);
    });

    it("should reject AliExpress non-product pages", () => {
      expect(isProductPage("https://www.aliexpress.com/")).toBe(false);
      expect(isProductPage("https://www.aliexpress.com/category/")).toBe(false);
      expect(isProductPage("https://www.aliexpress.com/cart")).toBe(false);
      expect(isProductPage("https://www.aliexpress.com/search")).toBe(false);
    });

    it("should detect general product pages", () => {
      expect(isProductPage("https://store.com/product/laptop-12345")).toBe(
        true
      );
      expect(isProductPage("https://shop.es/products/phone-67890")).toBe(true);
      expect(isProductPage("https://retail.com/item/tablet-abc123")).toBe(true);
    });

    it("should reject general non-product pages", () => {
      expect(isProductPage("https://store.com/")).toBe(false);
      expect(isProductPage("https://store.com/cart")).toBe(false);
      expect(isProductPage("https://store.com/checkout")).toBe(false);
      expect(isProductPage("https://store.com/account")).toBe(false);
      expect(isProductPage("https://store.com/contact")).toBe(false);
    });

    it("should handle malformed URLs gracefully", () => {
      expect(isProductPage("not-a-url")).toBe(false);
      expect(isProductPage("")).toBe(false);
      expect(isProductPage("https://")).toBe(false);
    });
  });

  describe("isProductPageForSite", () => {
    it("should detect Amazon product pages specifically", () => {
      expect(
        isProductPageForSite("https://www.amazon.es/dp/B0CFY9Q9TB", "amazon")
      ).toBe(true);
      expect(
        isProductPageForSite(
          "https://www.amazon.com/gp/product/B0D1CST2K3",
          "amazon"
        )
      ).toBe(true);
      expect(isProductPageForSite("https://www.amazon.es/", "amazon")).toBe(
        false
      );
      expect(
        isProductPageForSite("https://www.amazon.es/gp/cart", "amazon")
      ).toBe(false);
    });

    it("should detect eBay product pages specifically", () => {
      expect(
        isProductPageForSite("https://www.ebay.es/itm/123456", "ebay")
      ).toBe(true);
      expect(
        isProductPageForSite("https://www.ebay.com/itm/laptop", "ebay")
      ).toBe(true);
      expect(isProductPageForSite("https://www.ebay.es/", "ebay")).toBe(false);
      expect(isProductPageForSite("https://www.ebay.es/cart", "ebay")).toBe(
        false
      );
    });

    it("should detect AliExpress product pages specifically", () => {
      expect(
        isProductPageForSite(
          "https://www.aliexpress.com/item/123456",
          "aliexpress"
        )
      ).toBe(true);
      expect(
        isProductPageForSite(
          "https://www.aliexpress.es/item/product",
          "aliexpress"
        )
      ).toBe(true);
      expect(
        isProductPageForSite("https://www.aliexpress.com/", "aliexpress")
      ).toBe(false);
      expect(
        isProductPageForSite("https://www.aliexpress.com/cart", "aliexpress")
      ).toBe(false);
    });

    it("should fall back to general detection for unknown sites", () => {
      expect(
        isProductPageForSite("https://unknown.com/product/123", "unknown")
      ).toBe(true);
      expect(isProductPageForSite("https://unknown.com/", "unknown")).toBe(
        false
      );
    });
  });

  describe("getProductPageExplanation", () => {
    it("should explain product page detection", () => {
      const explanation = getProductPageExplanation(
        "https://www.amazon.es/dp/B0CFY9Q9TB"
      );
      expect(explanation).toContain("Product page detected");
      expect(explanation).toContain("/dp/");
    });

    it("should explain non-product page detection", () => {
      const explanation = getProductPageExplanation(
        "https://www.amazon.es/gp/cart"
      );
      expect(explanation).toContain("Not a product page");
      expect(explanation).toContain("/gp/cart");
    });

    it("should explain product-like structure detection", () => {
      const explanation = getProductPageExplanation(
        "https://store.com/electronics/laptop-123456"
      );
      expect(explanation).toContain("Product page detected");
      expect(explanation).toContain("product-like structure");
    });

    it("should handle malformed URLs", () => {
      const explanation = getProductPageExplanation("not-a-url");
      expect(explanation).toContain("Unable to analyze");
    });
  });

  describe("Edge cases", () => {
    it("should handle URLs with query parameters", () => {
      expect(
        isProductPage(
          "https://www.amazon.es/dp/B0CFY9Q9TB?ref_=pd_hp_d_btf_mii_recs&th=1"
        )
      ).toBe(true);
      expect(isProductPage("https://www.amazon.es/gp/cart?ref_=nav_cart")).toBe(
        false
      );
    });

    it("should handle URLs with fragments", () => {
      expect(isProductPage("https://www.amazon.es/dp/B0CFY9Q9TB#reviews")).toBe(
        true
      );
      expect(isProductPage("https://www.amazon.es/gp/cart#cart")).toBe(false);
    });

    it("should handle case sensitivity", () => {
      expect(isProductPage("https://www.AMAZON.ES/DP/B0CFY9Q9TB")).toBe(true);
      expect(isProductPage("https://www.amazon.es/GP/CART")).toBe(false);
    });

    it("should handle subdomains", () => {
      expect(isProductPage("https://shop.amazon.es/dp/B0CFY9Q9TB")).toBe(true);
      expect(isProductPage("https://shop.amazon.es/gp/cart")).toBe(false);
    });
  });
});
