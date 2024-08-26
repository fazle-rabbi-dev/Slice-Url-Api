import express from "express";
const router = express.Router();

import {
    createShortLink,
    getLinks,
    getSingleLink,
    handleShortLinkClick,
    deleteLink,
    changeLinkAlias,
    visitorCount
} from "../controllers/linkController.js";
import { verifyJwt, handleAnonymousUser } from "../utils/index.js";
import { linkShortnerLimiter } from "../utils/index.js";

const useLinkRouter = db => {
    const Links = db.collection("links");
    const Visitors = db.collection("Visitors");
    
    router.post("/api/links/shorten", linkShortnerLimiter, verifyJwt, createShortLink(Links));
    router.post("/api/links/shorten-anonymously", linkShortnerLimiter, handleAnonymousUser, createShortLink(Links));
    router.get("/api/links", verifyJwt, getLinks(Links));
    router.get("/api/links/:shortId", verifyJwt, getSingleLink(Links));
    router.get("/api/links/redirect/:shortId", handleShortLinkClick(Links));
    router.delete("/api/links/:shortId", verifyJwt, deleteLink(Links));
    router.patch("/api/links/:shortId", verifyJwt, changeLinkAlias(Links));

    /* Handle App Visitor Count */
    router.get("/visit", visitorCount(Visitors));
    
    return router;
};

export default useLinkRouter;
