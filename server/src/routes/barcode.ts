import { Router, Request, Response } from 'express';
import { query } from '../db';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// GET /barcode/:code
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const result = await query(
      'SELECT product_name, nutrition FROM barcode_cache WHERE barcode = $1',
      [code]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ found: false });
      return;
    }

    const row = result.rows[0];
    res.json({
      found: true,
      productName: row.product_name,
      nutrition: row.nutrition,
    });
  } catch (err) {
    console.error('Barcode lookup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /barcode/:code
router.put('/:code', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { productName, nutrition } = req.body;

    if (!productName || !nutrition) {
      res.status(400).json({ error: 'productName and nutrition are required' });
      return;
    }

    await query(
      `INSERT INTO barcode_cache (barcode, product_name, nutrition, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (barcode) DO UPDATE
       SET product_name = $2, nutrition = $3, updated_at = now()`,
      [code, productName, nutrition]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Barcode upsert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
