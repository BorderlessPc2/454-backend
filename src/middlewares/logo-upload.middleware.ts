import multer from "multer";

export const logoUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Apenas arquivos de imagem são permitidos."));
      return;
    }
    cb(null, true);
  },
}).single("logo");
