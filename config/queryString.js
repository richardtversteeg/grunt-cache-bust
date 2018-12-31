module.exports = {
    options: {
        assets: ['**/*.{css,jpg}'],
        baseDir: 'tests/queryString',
    },
    files: [{
        expand: true,
        cwd: 'tests/queryString',
        src: ['css/*.css', '*.html']
    }]
};
