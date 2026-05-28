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

router.post("/logo", logoUploadMiddleware, ConfiguracaoController.uploadLogo);



export default router;

