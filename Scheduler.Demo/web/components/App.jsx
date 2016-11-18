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

class JobGraph extends React.Component {

    componentWillMount() {
        this.elId = 'jobGraph' + this.props.schedId;
        this.ev$ = this.props.events;        
    }

    componentDidMount() {
        this.setup();
    }

    render() {
         return <div id={this.elId}></div>;
    }



    createPlots() {

    }


    setup() {
        const el = document.getElementById(this.elId),
            width = 600,
            height = 150,
            duration = 50,
            limit = 200;

        let evCount = 0;
        let increment = 0;        
        let buffer = d3.range(100).map(_ => 0);

        this.ev$.subscribe(_ => increment++);

        const plots = [
            {
                name: 'precise',
                colour: 'blue',
                scale: 20,
                getValue: () => {             
                    let v = increment;

                    buffer.push(increment);
                    buffer.shift();
                    increment = 0;

                    return v;
                }
            },
            {
                name: 'smooth',
                colour: 'purple',
                getValue: () => {
                    let w = buffer.length;
                    let c = buffer.reduce((ac, v, x) => ac + (v * (x / w) ));
                    console.log('overall hz', (c / (buffer.length / 2)) * (1000 / duration) );
                    return c * 0.15;
                }
            }
        ];


        let now = Date.now();

        const xScale = d3.scaleTime()
            .domain([now - (limit - 2) * duration, now - duration])
            .range([0, width])

        const yScale = d3.scaleLinear()
            .domain([0, 6])
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

        plots.forEach(p => {            
            p.data = d3.range(limit).map(() => 0);

            p.path = paths.append('path')
                        .datum(p.data)
                        .attr('class', 'path')
                        .style('stroke', p.colour)
                        .style('fill', 'none');
        });

        var tick = () => {
            now = Date.now();

            plots.forEach(p => {
                p.data.push(p.getValue());
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

            evCount += increment;
            increment = 0;
        };

        tick();
    }

}



function newJob$(schedId, jobId, ev$, hub) {
    let counter = 0;

    const change = (a, b) => {
        let v = a.target.value - 50;
        let weight = Math.pow(1.07, v);
        hub.invoke('updateJob', schedId, jobId, weight);
    }

    const render = () => {
        return <div><h4>{jobId}: {counter++}</h4><input type="range" onChange={change}/></div>;
    };

    return ev$.map(x => ({ id:jobId, el:render() }));
}



function newScheduler$(schedId, ev$, hub) {

    let addJob = () => {
        hub.invoke('updateJob', schedId, Guid.raw(), 1);
    };

    let removeScheduler = () => {
        hub.invoke('removeScheduler', schedId);
    }

    let setLimit = (e) => {
        let v = e.target.value - 50;
        let limit = Math.pow(1.05, v) * 3;
        
        document.getElementById('hz_out_' + schedId).value = limit + ' Hz';

        hub.invoke('setOverallLimit', schedId, limit);
    }


    return ev$.groupBy(ev => ev.jobId)
                .flatMap((group, i) => newJob$(schedId, group.key, group, hub))
                .scan((jobs, job) => { jobs.set(job.id, job.el); return jobs; }, new Map())
                .map(jobs => Array.from(jobs)
                                    .map(([k, v]) => <li key={k}>{v}</li>) )
                .map(jobEls => ({ 
                                  id: schedId, 
                                  el: <div>
                                          <button onClick={removeScheduler}>Remove Scheduler</button>

                                          <JobGraph schedId={schedId} events={ev$}/>

                                          <input type="range" onChange={setLimit} id={'hz_in_' + schedId}/>
                                          <output htmlFor={'hz_in_' + schedId} id={'hz_out_' + schedId}></output>

                                          <button onClick={addJob}>Add Job</button>

                                          <ul>{ jobEls }</ul>
                                      </div> 
                              }));
}

function newApp$(ev$, hub) {

    const fnClick = () => {
        var schedId = Guid.raw();
        hub.invoke('addScheduler', schedId);
        hub.invoke('updateJob', schedId, Guid.raw(), 1);
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
