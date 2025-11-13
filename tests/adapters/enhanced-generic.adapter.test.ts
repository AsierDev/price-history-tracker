import { describe, it, expect } from 'vitest';
import { EnhancedGenericAdapter } from '@adapters/implementations/enhanced-generic.adapter';

describe('EnhancedGenericAdapter', () => {
  const adapter = new EnhancedGenericAdapter();

  it('parses JSON-LD prices with comma decimals', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [{
                "@type": "Product",
                "name": "Motorola Edge 60 Fusion",
                "image": ["https://example.com/image.jpg"],
                "offers": {
                  "@type": "Offer",
                  "price": "249,90",
                  "priceCurrency": "EUR"
                }
              }]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.title).toBe('Motorola Edge 60 Fusion');
    expect(result.price).toBeCloseTo(249.9, 2);
    expect(result.currency).toBe('EUR');
    expect(result.available).toBe(true);
  });

  it('prefers structured price over shipping info in DOM', async () => {
    const html = `
      <html>
        <body>
          <div class="shipping-info">Envío 7,90 €</div>
          <div class="product-price" data-price="129,90 €">
            <span itemprop="price">129,90 €</span>
          </div>
        </body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.price).toBeCloseTo(129.9, 2);
    expect(result.currency).toBe('EUR');
  });

  it('ignores financing monthly payments in DOM', async () => {
    const html = `
      <html>
        <body>
          <div class="financing">40 €/mes</div>
          <div class="price-main">
            <span class="price-value">249,90 €</span>
          </div>
        </body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.price).toBeCloseTo(249.9, 2);
    expect(result.currency).toBe('EUR');
  });
});
