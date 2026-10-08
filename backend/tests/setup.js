// Variables d'environnement pour les tests
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok_!'
process.env.JWT_EXPIRES_IN = '1d'
process.env.NODE_ENV = 'test'
process.env.DB_HOST = 'localhost'
process.env.DB_USER = 'test'
process.env.DB_PASSWORD = 'test'
process.env.DB_NAME = 'test'
process.env.FRONTEND_URL = 'http://localhost:5173'
