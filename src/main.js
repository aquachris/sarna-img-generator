const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { createInnerSphereImage } = require('./createInnerSphereImage');
const { createUniverseImage } = require('./createUniverseImage');
const { createNeighborhoodImage } = require('./createNeighborhoodImages');
const { createRegionImage } = require('./createRegionImage');

yargs(hideBin(process.argv))
  .command('generate [type] [year] [system]', 'generate one or more maps', (yargs) => {
    return yargs
      .positional('type', {
        describe: 'type of map (neighborhood, innersphere or universe)',
        type: 'string',
        default: 'innersphere'
      })
      .positional('year', {
        describe: 'in-universe year to generate the maps for (default: all available years)',
        type: 'number',
        default: undefined,
      })
      .positional('system', {
        describe: '(part of) the system names to generate neighborhood maps for',
        type: 'string',
        default: ''
      })
  }, (argv) => {
    console.log('Sarna interstellar map generator');
    try {
      switch (argv.type.toLowerCase()) {
        case 'innersphere':
          createInnerSphereImage(argv.year);
          break;
        case 'universe':
          createUniverseImage(argv.year);
          break;
        case 'neighborhood':
          createNeighborhoodImage(argv.year, argv.system);
          break;
        case 'region':
          createRegionImage();
          break;
        default:
          throw new Error(`Cannot generate map images: Map type "${argv.type}" is unknown.`);
      }
      console.log(`----------`);
      console.log('Done! Please check the output folder for your results.');
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })
  .parse()
