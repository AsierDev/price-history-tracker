import { describe, it, expect } from 'vitest';
import { ElCorteInglesAdapter } from '../../src/adapters/implementations/elcorteingles.adapter';

describe('ElCorteInglesAdapter - Sale Price Fix', () => {
  const adapter = new ElCorteInglesAdapter();

  it('should extract sale price (999€) not original price (1999€)', async () => {
    const html = `
      <html>
        <head><title>Samsung TV</title></head>
        <body>
          <h1 data-product-name>TV OLED 139cm (55") Samsung TQ55S93FAEXXC</h1>
          <div data-v-6a04be43="" class="price-container">
            <span data-v-6a04be43="" aria-label="Precio de venta" class="price-sale">999 €</span>
            <span data-v-6a04be43="" aria-label="Precio original" class="price-unit--original product-detail-price">1.999 €</span>
            <span data-v-6a04be43="" aria-label="Descuento" class="price-discount">50% </span>
          </div>
        </body>
      </html>
    `;

    const result = await adapter.extractData(html);
    
    expect(result.price).toBe(999);
    expect(result.currency).toBe('EUR');
    expect(result.title).toContain('Samsung');
  });

  it('should handle price-sale without nested elements', async () => {
    const html = `
      <html>
        <body>
          <h1>Producto</h1>
          <span class="price-sale">299 €</span>
        </body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.price).toBe(299);
  });
});
