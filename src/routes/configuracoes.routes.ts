import { Router } from "express";

import { ConfiguracaoController } from "../controllers/configuracao.controller.js";

import { protectedMiddleware } from "../middlewares/protected.middleware.js";

import { logoUploadMiddleware } from "../middlewares/logo-upload.middleware.js";

import { roleMiddleware } from "../middlewares/role.middleware.js";



const router = Router();



router.use(...protectedMiddleware);



router.get("/pdf", ConfiguracaoController.findPdfSettings);



router.use(roleMiddleware("ADMIN"));

router.get("/", ConfiguracaoController.findAll);

router.put("/", ConfiguracaoController.upsert);

router.post("/logo", (req, res, next) => {
  logoUploadMiddleware(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao processar upload da logo";
      res.status(400).json({ error: message });
      return;
    }
    void ConfiguracaoController.uploadLogo(req, res);
  });
});



export default router;

