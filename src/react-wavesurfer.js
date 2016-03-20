/* global WaveSurfer */
import React, {Component, PropTypes} from 'react';
import merge from 'merge';
import _ from 'lodash';

// import wavesurfer.js commonjs build
const WaveSurfer = require('wavesurfer.js');

const EVENTS = [
  'audioprocess',
  'error',
  'finish',
  'loading',
  'mouseup',
  'pause',
  'play',
  'ready',
  'scroll',
  'seek',
  'zoom'
];

/*const REGION_EVENTS = [
  'region-in ',
  'region-out',
  'region-mouseenter',
  'region-mouseleave',
  'region-click',
  'region-dblclick',
  'region-created ',
  'region-updated ',
  'region-update-end ',
  'region-removed '
];*/

/**
 * @description Capitalise the first letter of a string
 */
function capitaliseFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * @description Throws an error if the prop is defined and not an integer or not positive
 */
function positiveIntegerProptype(props, propName, componentName) {
  let n = props[propName];
  if (n !== undefined && (typeof n !== 'number' || n !== parseInt(n, 10) || n < 0)) {
    return new Error('Invalid `' + propName + '` supplied to `' + componentName + '`' +
      ', expected a positive integer');
  }
}



class Wavesurfer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      pos: 0
    };

    if (typeof WaveSurfer === undefined) {
      throw new Error('WaveSurfer is undefined!');
    }

    this._wavesurfer = Object.create(WaveSurfer);
    this._fileLoaded = false;
    this._playing = false;
    this._loadAudio = this._loadAudio.bind(this);
    this._seekTo = this._seekTo.bind(this);
  }

  componentDidMount() {
    const options = merge.recursive({}, this.props.options, {
      container: this.refs.wavesurfer
    });

    this._wavesurfer.init(options);

    // file was loaded, wave was drawn, update the _fileLoaded flag
    this._wavesurfer.on('ready', () => {
      this._fileLoaded = true;
      // if there is a position set via prop, go there …
      if (this.props.pos) {
        this._seekTo(this.props.pos);
      }
      if (this.props.regions) {
        this.props.regions.forEach((region) => {
          this._wavesurfer.addRegion(region);
        });
      }
    });

    this._wavesurfer.on('audioprocess', (pos) => {
      this.setState({
        pos
      });
      this.props.onPosChange({
        wavesurfer: this._wavesurfer,
        originalArgs: [pos]
      });
    });

    // `audioprocess` is not fired when seeking, so we have to plug into the
    // `seek` event and calculate the equivalent in seconds (seek event
    // receives a position float 0-1) – See the README.md for explanation why we
    // need this
    this._wavesurfer.on('seek', (pos) => {
      pos = this._posToSec(pos);
      this.setState({
        pos
      });
      this.props.onPosChange({
        wavesurfer: this._wavesurfer,
        originalArgs: [pos]
      });
    });

    const hookUpPropCallback = (e) => {
      const propCallback = this.props['on' + capitaliseFirstLetter(e)];
      const wavesurfer = this._wavesurfer;
      if (propCallback) {
        this._wavesurfer.on(e, function () {
          propCallback({
            wavesurfer: wavesurfer,
            originalArgs: [...arguments]
          });
        });
      }
    };

    // hook up events to callback handlers passed in as props
    EVENTS.forEach(hookUpPropCallback);

    // do stuff for regions
    /*if (this.props.regions) {
      REGION_EVENTS.forEach(hookUpPropCallback);
    }*/

    // if audioFile prop, load file
    if (this.props.audioFile) {
      this._loadAudio(this.props.audioFile);
    }
  }

  componentWillUnmount() {
    // remove listeners
    EVENTS.forEach((e) => {
      this._wavesurfer.un(e);
    });

    /*if (this.props.regions) {
      REGION_EVENTS.forEach((e) => {
        this._wavesurfer.un(e);
      });
    }
*/    // destroy wavesurfer instance
    this._wavesurfer.destroy();
  }

  // update wavesurfer rendering manually
  componentWillReceiveProps(nextProps) {
    if (this.props.audioFile !== nextProps.audioFile) {
      this._loadAudio(nextProps.audioFile);
    }

    if (nextProps.pos &&
        this._fileLoaded &&
        nextProps.pos !== this.props.pos &&
        nextProps.pos !== this.state.pos) {
      this._seekTo(nextProps.pos);
    }
    /*if (nextProps.regions) {
      const _regionsToDelete = this._wavesurfer.regions.list;
      nextProps.regions.forEach((region) => {
        // update region
        if (region.id && this._wavesurfer.regions.list[region.id]) {
          this._wavesurfer.regions.list[region.id].update(region);
        } else {
          // new region
          this.wavesurfer.addRegion(region);
        }
      });
      if (_regionsToDelete.length) {
        _regionsToDelete.forEach((regionToDelete) => {
          this._wavesurfer.regions.list[regionToDelete.id].remove();
        });
      }
    }*/
    if (this.props.playing !== nextProps.playing) {
      if (nextProps.playing) {
        this._wavesurfer.play();
        this._playing = true;
      } else {
        this._wavesurfer.pause();
        this._playing = false;
      }
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }

  // receives seconds and transforms this to the position as a float 0-1
  _secToPos(sec) {
    return 1 / this._wavesurfer.getDuration() * sec;
  }

  // receives position as a float 0-1 and transforms this to seconds
  _posToSec(pos) {
    return pos * this._wavesurfer.getDuration();
  }

  // pos is in seconds, the 0-1 proportional position we calculate here …
  _seekTo(sec) {
    const pos = this._secToPos(sec);
    if (this.props.autoCenter) {
      this._wavesurfer.seekAndCenter(pos);
    } else {
      this._wavesurfer.seekTo(pos);
    }
  }

  _loadAudio(audioFile) {
    // bog-standard string is handled by load method and ajax call
    if (typeof audioFile === 'string') {
      this._wavesurfer.load(audioFile);
    } else if (audioFile instanceof Blob || audioFile instanceof File) {
      // blob or file is loaded with loadBlob method
      this._wavesurfer.loadBlob(audioFile);
    } else {
      throw new Error('Wavesurfer._loadAudio expexts prop audioFile to be either string or file/blob');
    }
  }

  render() {
    return (
      <div ref='wavesurfer' />
    );
  }
}

Wavesurfer.propTypes = {
  playing: PropTypes.bool,
  pos: PropTypes.number,
  audioFile: function(props, propName, componentName) {
    const prop = props[propName];
    if (prop && typeof prop !== 'string' && !prop instanceof Blob && !prop instanceof File) {
      return new Error('Invalid `' + propName + '` supplied to `' + componentName +
          '` expected either string or file/blob');
    }
  },
  regions: PropTypes.array,
  options: PropTypes.shape({
    audioRate: PropTypes.number,
    backend: PropTypes.oneOf(['WebAudio', 'MediaElement']),
    barWidth: function(props, propName, componentName) {
      const prop = props[propName];
      if (prop !== undefined && typeof prop !== 'number') {
        return new Error('Invalid `' + propName + '` supplied to `' + componentName +
          '` expected either undefined or number');
      }
    },
    cursorColor: PropTypes.string,
    cursorWidth: positiveIntegerProptype,
    dragSelection: PropTypes.bool,
    fillParent: PropTypes.bool,
    height: positiveIntegerProptype,
    hideScrollbar: PropTypes.bool,
    interact: PropTypes.bool,
    loopSelection: PropTypes.bool,
    mediaControls: PropTypes.bool,
    minPxPerSec: positiveIntegerProptype,
    normalize: PropTypes.bool,
    pixelRatio: PropTypes.number,
    progressColor: PropTypes.string,
    scrollParent: PropTypes.bool,
    skipLength: PropTypes.number,
    waveColor: PropTypes.string,
    autoCenter: PropTypes.bool
  })
};

Wavesurfer.defaultProps = {
  playing: false,
  pos: 0,
  audioFile: undefined,
  options: WaveSurfer.defaultParams,
  onPosChange: function() {}
};

export default Wavesurfer;

