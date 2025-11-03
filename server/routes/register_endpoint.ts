// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const validated = registerSchema.parse(req.body);
    const { email, password, name } = validated;

    try {
      const result = await authService.register({ email, password, name });

      res.status(201).json({
        message: result.message,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          emailVerified: result.user.emailVerified,
        }
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' });
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid registration data' });
  }
});