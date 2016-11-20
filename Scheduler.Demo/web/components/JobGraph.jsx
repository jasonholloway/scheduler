import React from 'react'
import Guid from 'guid'
const d3 = require('d3');
d3.scale = require('d3-scale');
d3.time = require('d3-time');
// import * as d3 from 'd3'
// import {time as currTime, scale as currScale, svg as currSvg} from 'd3';

class JobGraph extends React.Component {

    componentWillMount() {
        this.guid = Guid.raw();
        this.elId = 'jobGraph' + this.guid;  
        this.spec = this.props.spec;
    }

    componentDidMount() {
        this.elOverall = document.getElementById('overall_' + this.guid);
        this.setup();
    }

    render() {
         return <div className="job-graph">
                    <div id={this.elId}></div>       
                </div>;
    }


    setup() {
        const el = document.getElementById(this.elId),
            width = 600,
            height = this.spec.height,
            duration = 50,
            limit = 200;

        let now = Date.now();

        const xScale = d3.scaleTime()
            .domain([now - (limit - 2) * duration, now - duration])
            .range([0, width])

        const yScale = d3.scaleLinear()
            .domain([0, (height / 100) * this.spec.scale])
            .range([height, 0])

        const line = d3.line()
                    .curve(d3.curveCatmullRomOpen)
                    .x((d, i) => xScale(now - (limit - 1 - i) * duration))            
                    .y(yScale);

        const svg = d3.select(el).append('svg')
                    .attr('class', 'chart')
                    .attr('width', width)
                    .attr('height', height + 10)

        const paths = svg.append('g')

        const plots = this.spec.plots.map(p => {            
            let data = d3.range(limit).map(() => 0);

            return {
                spec: p,
                data: data,
                path: paths.append('path')
                        .datum(data)
                        .attr('class', 'path')
                        .style('stroke', p.colour)
                        .style('fill', 'none')
            };
        });

        var tick = () => {
            now = Date.now();

            plots.forEach(p => {
                p.data.push(p.spec.getValue());
                p.data.shift();

                p.path.attr('d', line);
            });

            xScale.domain([now - (limit - 2) * duration, now - duration])

            var z = paths.attr('transform', null)
                .transition()           
                .duration(duration)
                .ease(d3.easeLinear)
                .attr('transform', 'translate(' + xScale(now - (limit - 1) * duration) + ')')
                .on('end', tick);
        };

        tick();
    }

}

export default JobGraph;

