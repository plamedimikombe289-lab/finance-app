const multer = require('multer')
const path   = require('path')
const crypto = require('crypto')
const fs     = require('fs')

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/depenses')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const ALLOWED_MIME = {
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
  'image/webp':      '.webp',
  'image/gif':       '.gif',
  'application/pdf': '.pdf',
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file,  cb) => {
    const ext = ALLOWED_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase()
    cb(null, crypto.randomBytes(16).toString('hex') + ext)
  },
})

module.exports = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) return cb(null, true)
    const err = new Error('Type non autorisé. Formats acceptés : JPG, PNG, WEBP, GIF, PDF.')
    err.status = 400
    cb(err)
  },
})
