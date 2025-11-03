import express from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { authenticateToken, AuthenticatedRequest, requirePermission } from '../middleware/enhancedAuth';

const router = express.Router();

// Create API key
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, permissions, expiresInDays } = req.body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Name and permissions are required' });
    }

    const apiKey = await ApiKeyService.createApiKey(
      req.user!.id,
      name,
      permissions,
      expiresInDays
    );

    res.status(201).json({
      message: 'API key created successfully',
      apiKey: {
        id: apiKey.id,
        key: apiKey.key,
        name: apiKey.name,
        permissions: apiKey.permissions,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create API key' });
  }
});

// List API keys
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKeys = await ApiKeyService.listApiKeys(req.user!.id, req.user!.role);

    res.json({
      apiKeys: apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        expiresAt: key.expiresAt,
        isActive: key.isActive
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Get API key details
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const apiKey = await ApiKeyService.getApiKeyUsageStats(req.user!.id, id, req.user!.role);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json(apiKey);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API key details' });
  }
});

// Update API key
router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, permissions, isActive } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'API key ID is required' });
    }

    const success = await storage.updateApiKey(id, { name, permissions, isActive });

    if (success) {
      res.json({ message: 'API key updated successfully' });
    } else {
      res.status(404).json({ error: 'API key not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// Revoke API key
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'API key ID is required' });
    }

    const success = await ApiKeyService.revokeApiKey(req.user!.id, id, req.user!.role);

    if (success) {
      res.json({ message: 'API key revoked successfully' });
    } else {
      res.status(404).json({ error: 'API key not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
