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
    
    router.post("/links/shorten", linkShortnerLimiter, verifyJwt, createShortLink(Links));
    router.post("/links/shorten-anonymously", linkShortnerLimiter, handleAnonymousUser, createShortLink(Links));
    router.get("/links", verifyJwt, getLinks(Links));
    router.get("/links/:shortId", verifyJwt, getSingleLink(Links));
    router.get("/links/redirect/:shortId", handleShortLinkClick(Links));
    router.delete("/links/:shortId", verifyJwt, deleteLink(Links));
    router.patch("/links/:shortId", verifyJwt, changeLinkAlias(Links));

    /* Handle App Visitor Count */
    router.get("/visit", visitorCount(Visitors));
    
    return router;
};

export default useLinkRouter;
