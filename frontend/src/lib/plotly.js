import Plotly from 'plotly.js/lib/core';
import bar from 'plotly.js/lib/bar';
import heatmap from 'plotly.js/lib/heatmap';
import scatter from 'plotly.js/lib/scatter';
import scattergl from 'plotly.js/lib/scattergl';
import createPlotlyComponent from 'react-plotly.js/factory';

Plotly.register([scatter, scattergl, heatmap, bar]);

const Plot = createPlotlyComponent(Plotly);

export { Plotly };
export default Plot;
