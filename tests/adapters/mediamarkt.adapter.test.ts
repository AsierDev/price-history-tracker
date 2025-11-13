import { describe, it, expect } from 'vitest';
import { MediaMarktAdapter } from '@adapters/implementations/mediamarkt.adapter';

describe('MediaMarktAdapter', () => {
  const adapter = new MediaMarktAdapter();

  it('prefers branded DOM price when JSON-LD price is malformed', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [{
                "@type": "Product",
                "name": "PC Gaming GREED MK2",
                "image": ["//assets.mmsrg.com/isr/166325/c1/pc-gaming.png"],
                "offers": {
                  "@type": "Offer",
                  "price": "2",
                  "priceCurrency": "EUR",
                  "availability": "https://schema.org/InStock"
                }
              }]
            }
          </script>
        </head>
        <body>
          <div data-test="cofr-price mms-branded-price">
            <div data-test="branded-price-whole-value">1.399,</div>
            <div data-test="branded-price-decimal-value">90</div>
            <span data-test="branded-price-currency">€</span>
          </div>
        </body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.price).toBeCloseTo(1399.9, 2);
    expect(result.currency).toBe('EUR');
    expect(result.imageUrl).toBe('https://assets.mmsrg.com/isr/166325/c1/pc-gaming.png');
  });

  it('falls back to JSON-LD when DOM price is missing', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [{
                "@type": "Product",
                "name": "PC Gaming GREED MK2",
                "image": ["//assets.mmsrg.com/isr/166325/c1/pc-gaming.png"],
                "offers": {
                  "@type": "Offer",
                  "price": "1.399,90",
                  "priceCurrency": "EUR",
                  "availability": "https://schema.org/InStock"
                }
              }]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.title).toBe('PC Gaming GREED MK2');
    expect(result.price).toBeCloseTo(1399.9, 2);
    expect(result.currency).toBe('EUR');
    expect(result.imageUrl).toBe('https://assets.mmsrg.com/isr/166325/c1/pc-gaming.png');
    expect(result.available).toBe(true);
  });

  it('falls back to DOM selectors when JSON-LD is missing', async () => {
    const html = `
      <html>
        <body>
          <h1 data-test="product-title">Monitor Gaming 27"</h1>
          <div class="m-priceBox__price" data-price="799,00 €"></div>
          <div class="m-productGallery__image">
            <img data-src="//cdn.mediamarkt.es/images/monitor.png" width="400" height="300" />
          </div>
          <div class="m-availability">Disponible online</div>
        </body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.title).toBe('Monitor Gaming 27"');
    expect(result.price).toBeCloseTo(799, 2);
    expect(result.currency).toBe('EUR');
    expect(result.imageUrl).toBe('https://cdn.mediamarkt.es/images/monitor.png');
    expect(result.available).toBe(true);
  });
});
