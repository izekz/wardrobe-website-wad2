function handleWardrobeError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if ([400, 404].includes(error.status))
    return res.status(error.status).json({ message: error.message });
  if (error.name === "ValidationError")
    return res
      .status(400)
      .json({ message: "Check clothing details and try again." });
  next(error);
}
module.exports = { handleWardrobeError };
