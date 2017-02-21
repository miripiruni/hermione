'use strict';

const _ = require('lodash');
const Config = require('../../../lib/config');
const defaults = require('../../../lib/config/defaults');

const parser = require('../../../lib/config/options');

describe('config options', () => {
    const sandbox = sinon.sandbox.create();

    const createConfig = () => Config.create(defaults.config);

    beforeEach(() => sandbox.stub(Config, 'read'));

    afterEach(() => sandbox.restore());

    describe('system', () => {
        describe('debug', () => {
            it('should throw error if debug is not a boolean', () => {
                const readConfig = _.set({}, 'system.debug', 'String');

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"debug" must be a boolean');
            });

            it('should set default debug option if it does not set in config file', () => {
                const config = createConfig();

                assert.equal(config.system.debug, defaults.debug);
            });

            it('should override debug option', () => {
                const readConfig = _.set({}, 'system.debug', true);
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.system.debug, true);
            });
        });

        describe('mochaOpts', () => {
            it('should throw error if mochaOpts is not a null or object', () => {
                const readConfig = _.set({}, 'system.mochaOpts', ['Array']);

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"mochaOpts" must be an object');
            });

            it('should set default mochaOpts option if it does not set in config file', () => {
                const config = createConfig();

                assert.deepEqual(config.system.mochaOpts, defaults.mochaOpts);
            });

            it('should override mochaOpts option', () => {
                const readConfig = _.set({}, 'system.mochaOpts.grep', /test/);
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.system.mochaOpts.grep, /test/);
            });
        });

        describe('ctx', () => {
            it('should be empty by default', () => {
                const config = createConfig();

                assert.deepEqual(config.system.ctx, {});
            });

            it('should override ctx option', () => {
                const readConfig = _.set({}, 'system.ctx', {some: 'ctx'});
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.system.ctx, {some: 'ctx'});
            });
        });
    });

    describe('prepareEnvironment', () => {
        it('should throw error if prepareEnvironment is not a null or function', () => {
            const readConfig = {prepareEnvironment: 'String'};

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"prepareEnvironment" must be a function');
        });

        it('should set default prepareEnvironment option if it does not set in config file', () => {
            const config = createConfig();

            assert.equal(config.prepareEnvironment, defaults.prepareEnvironment);
        });

        it('should override prepareEnvironment option', () => {
            const newFunc = () => {};
            const readConfig = {prepareEnvironment: newFunc};

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.prepareEnvironment, newFunc);
        });
    });

    describe('plugins', () => {
        const parse_ = (opts) => parser(_.defaults(opts, {env: {}, argv: []}));

        it('should parse boolean value from environment', () => {
            const result = parse_({
                options: {plugins: {foo: {}}},
                env: {'hermione_plugins_foo': 'true'}
            });

            assert.strictEqual(result.plugins.foo, true);
        });

        it('should parse object value from environment', () => {
            const result = parse_({
                options: {plugins: {foo: {}}},
                env: {'hermione_plugins_foo': '{"opt": 1}'}
            });

            assert.deepEqual(result.plugins.foo, {opt: 1});
        });

        it('should throw error on invalid values from environment', () => {
            assert.throws(
                () => parse_({
                    options: {plugins: {foo: {}}},
                    env: {'hermione_plugins_foo': '{key: 1}'}
                }),
                'a value must be a primitive type'
            );
        });

        it('should parse boolean value from cli', () => {
            const result = parse_({
                options: {plugins: {foo: {}}},
                argv: ['--plugins-foo', 'true']
            });

            assert.strictEqual(result.plugins.foo, true);
        });

        it('should parse object value from cli', () => {
            const result = parse_({
                options: {plugins: {foo: {}}},
                argv: ['--plugins-foo', '{"opt": 1}']
            });

            assert.deepEqual(result.plugins.foo, {opt: 1});
        });

        it('should throw error on invalid values from cli', () => {
            assert.throws(
                () => parse_({
                    options: {plugins: {foo: {}}},
                    argv: ['--plugins-foo', '{key: 1}']
                }),
                'a value must be a primitive type'
            );
        });
    });
});
