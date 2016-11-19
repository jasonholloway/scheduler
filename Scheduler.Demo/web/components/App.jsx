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
        this.guid = Guid.raw();
        this.elId = 'jobGraph' + this.guid;
        this.ev$ = this.props.events;        
    }

    componentDidMount() {
        this.elOverall = document.getElementById('overall_' + this.guid);
        this.setup();
    }

    render() {
         return <div>
                    <div id={this.elId}></div>                    
                    <section> 
                        <label htmlFor={'overall_' + this.guid}>Real overall rate</label>
                        <output id={'overall_' + this.guid}>123</output> 
                    </section>
                </div>;
    }



    createPlots() {

    }



    createWindowConvolution(l) {
        let scaler = Math.pow(2 * Math.PI, 1/3);

        let fnWindow = x => 0.5 * 
                                ( Math.sin( 
                                        Math.pow( (x / l) * scaler, 3)  - (Math.PI / 2)) 
                                        + 1 ); 

        let d = d3.range(l).map(fnWindow);

        return d;
    }


    setup() {
        const el = document.getElementById(this.elId),
            width = 600,
            height = 150,
            duration = 50,
            limit = 200;

        let evCount = 0;
        let increment = 0;        

        let buffer = d3.range(200).map(_ => 0);
        let bufferWindow = this.createWindowConvolution(buffer.length);

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
                    // let hits = buffer.reduce((a,b) => a+b);
                    // let area = buffer.length * 1;

                    let hits = wu.zipWith((a,b) => a*b, buffer, bufferWindow).reduce((a,b) => a+b);
                    let area = wu(bufferWindow).reduce((a,b) => a+b);

                    let hz = (hits / area) * (1000 / duration);
                    this.elOverall.value = `${hz.toPrecision(3)} Hz`;

                    return hz * 0.2;
                }
            },
            {
                name: 'ajob',     //each job needs to have its own buffer etc.
                colour: 'orange',
                getValue: () => 2.5
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

        document.getElementById(`weight_out_${jobId}`).value = weight.toPrecision(3);
    }

    const remove = (a, b) => {
        hub.invoke('updateJob', schedId, jobId, 0);
    }

    const render = () => {
        return <div>
                    <h4>{jobId}</h4>

                    <button onClick={remove}>Remove</button>

                    <JobGraph events={ev$}/>

                    <label htmlFor={`weight_in_${jobId}`}>Weight</label>
                    <input type="range" onChange={change} id={`weight_in_${jobId}`}/>
                    <output htmlFor={`weight_in_${jobId}`} id={`weight_out_${jobId}`}>1.00</output>

                    <label htmlFor={`job_count_${jobId}`}>Call count</label>
                    <output id={`job_count_${jobId}`}>{counter++}</output>
                    
                    <label htmlFor={`job_rate_${jobId}`}>Real rate</label>
                    <output id={`job_rate_${jobId}`}>?</output>
                    
                </div>;
    };

    return ev$.map(x => ({ id:jobId, el:render() }));
}



function newScheduler$(schedId, ev$, hub) {

    let addJob = () => {
        hub.invoke('updateJob', schedId, Guid.raw(), 1);
    };

    let setLimit = (e) => {
        let v = e.target.value - 50;
        let limit = Math.pow(1.05, v) * 3;
        
        document.getElementById('hz_out_' + schedId).value = limit.toPrecision(3) + ' Hz';

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
                                          <JobGraph events={ev$}/>
                                          
                                          <input type="range" onChange={setLimit} id={'hz_in_' + schedId}/>
                                          <label htmlFor={'hz_out_' + schedId}>Limit</label>
                                          <output htmlFor={'hz_in_' + schedId} id={'hz_out_' + schedId}></output>

                                          <button onClick={addJob}>Add Job</button>

                                          <ul>{ jobEls }</ul>
                                      </div> 
                              }));
}

function newApp$(ev$, hub) {
    return ev$
            .groupBy(ev => ev.schedId)               
            .flatMap((group, i) => newScheduler$(group.key, group, hub))
            .scan((scheds, sched) => { scheds.set(sched.id, sched.el); return scheds; }, new Map())    
            .map(scheds => Array.from(wu(scheds.entries()).map(([k, v]) => <li key={k}>{v}</li>)))
            .map(els => <div>
                            <ul>{els}</ul>
                        </div>);
                
}


export default newApp$;
