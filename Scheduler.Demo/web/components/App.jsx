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
        
        this.currEvCount = 0;
        this.prevEvCount = 0;
        
        this.ev$.scan((c, ev) => c + 1, 0)
                .subscribe(c => this.currEvCount = c);
    }

    componentDidMount() {
        this.setup();
    }

    render() {
         return <div id={this.elId}></div>;
    }

    setup() {
        const el = document.getElementById(this.elId),
            width = 500,
            height = 100,
            duration = 100,
            limit = 80;


        const plots = [
            {
                name: 'precise',
                colour: 'blue',
                getValue: () => {                    
                    let diffEvCount = this.currEvCount - this.prevEvCount;
                    this.prevEvCount = this.currEvCount;
                    return diffEvCount * 33;
                }
            },
            {
                name: 'smooth',
                colour: 'purple',
                getValue: () => 50
            }
        ];


        let now = Date.now();

        const xScale = d3.scaleTime()
            .domain([now - (limit - 2) * duration, now - duration])
            .range([0, width])

        const yScale = d3.scaleLinear()
            .domain([0, 100])
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

            // Shift domain
            xScale.domain([now - (limit - 2) * duration, now - duration])

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
                .attr('transform', 'translate(' + xScale(now - (limit - 1) * duration) + ')')
                .on('end', tick);
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

        console.log('limit', limit);

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
                                          <input type="range" onChange={setLimit}/>
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
