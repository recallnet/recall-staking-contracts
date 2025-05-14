module.exports = {
    skipFiles: ["interfaces/", "mock/"],
    modifierWhitelist: ["onlyInitializing", "nonReentrant"],
    configureYulOptimizer: true,
};
