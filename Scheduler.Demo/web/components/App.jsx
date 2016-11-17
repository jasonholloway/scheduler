import React from 'react'
import Scheduler from './Scheduler.jsx'
import Guid from 'guid'
import Rx from 'rxjs'
import wu from 'wu'
const d3 = require('d3');
d3.scale = require('d3-scale');
d3.time = require('d3-time');
// import * as d3 from 'd3'
// import {time as currTime, scale as currScale, svg as currSvg} from 'd3';


console.log(d3);


function newJob$(jobId, ev$, hub) {
    let counter = 0;

    return ev$.scan((ac, ev) => <h4>{ev.jobId}: {counter++}</h4>, {})
              .map(x => ({ id:jobId, el:x }));
}


class JobGraph extends React.Component {

    componentWillMount() {
        this.elId = 'jobGraph' + this.props.schedId;
    }

    componentDidMount() {
        this.setup();
    }

    render() {
         return <div id={this.elId}></div>;
    }

    setup() {
        const el = document.getElementById(this.elId),
            width = 400,
            height = 100,
            duration = 500,
            limit = 60;

        let now = Date.now();
        let data = d3.range(500).map(_ => 0);

        const x = d3.scaleTime()
            .domain([now - (limit - 2), now - duration])
            .range([0, width])

        const y = d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0])

        const line = d3.line()
                    .curve(d3.curveCatmullRomOpen)
                    .x((d, i) => x(now - (limit - 1 - i) * duration))            
                    .y((d) => y(d));

        const svg = d3.select(el).append('svg')
                    .attr('class', 'chart')
                    .attr('width', width)
                    .attr('height', height + 50)

        const paths = svg.append('g')

        const path = paths.append('path')
                    .datum(data)
                    .attr('class', 'path')
                    .style('stroke', 'blue');

        var tick = () => {
            now = Date.now();

            data.push(20 + Math.random() * 100);
            path.attr('d', line);

            data.shift();

            // Shift domain

            var xDomain = [now - (limit - 2) * duration, now - duration];
            console.log('now', now);
            console.log('limit', limit);
            console.log('xDomain', xDomain);

            x.domain(xDomain)

            // Slide x-axis left
            // axis.transition()
            //     .duration(duration)
            //     .ease(d3.easeLinear)
            //     .call(axis)

            // Slide paths left
            var z = paths.attr('transform', null)
                .transition()           
                .duration(duration)
                .ease(d3.easeLinear)
                .attr('transform', 'translate(' + x(now - (limit - 1) * duration) + ')')
                .on('end', tick)

        };

        tick(x);
    }

}



function newScheduler$(schedId, ev$, hub) {

    const onClick = () => {
        hub.invoke('addJob', schedId, Guid.raw());
    };

    return ev$.groupBy(ev => ev.jobId)
                .flatMap((group, i) => newJob$(group.key, group, hub))
                .scan((jobs, job) => { jobs.set(job.id, job.el); return jobs; }, new Map())
                .map(jobs => Array.from(jobs)
                                    .map(([k, v]) => <li key={k}>{v}</li>) )
                .map(jobEls => ({ 
                                  id: schedId, 
                                  el: <div>
                                          <JobGraph schedId={schedId}/>
                                          <button onClick={onClick}>Add Job</button>
                                          <ul>{ jobEls }</ul>
                                      </div> 
                              }));
}

function newApp$(ev$, hub) {

    const fnClick = () => {
        var schedId = Guid.raw();
        hub.invoke('addScheduler', schedId);
        hub.invoke('addJob', schedId, Guid.raw());
    };

    fnClick();

    return ev$
            .groupBy(ev => ev.schedId)               
            .flatMap((group, i) => newScheduler$(group.key, group, hub))
            .scan((scheds, sched) => { scheds.set(sched.id, sched.el); return scheds; }, new Map())    
            .map(scheds => Array.from(wu(scheds.entries()).map(([k, v]) => <li key={k}>{v}</li>)))
            .map(els => <div>
                            <button onClick={fnClick}>Add Scheduler</button>
                            <ul>{els}</ul>
                        </div>);
                
}


export default newApp$;
