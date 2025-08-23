import express from 'express';

const router = express.Router();

router.get('/test', (_req, res) => {
  res.json({ message: 'File routes working' });
});

export default router;