import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import barcodeRoutes from './routes/barcode';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS — allow the frontend origin
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/barcode', barcodeRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ScaleShift API listening on port ${PORT}`);
});
