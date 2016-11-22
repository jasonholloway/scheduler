import React from 'react'
import Scheduler from './Scheduler.jsx'
import JobGraph from './JobGraph.jsx'
import Guid from 'guid'
import Rx from 'rxjs'
import wu from 'wu'
const d3 = require('d3');


function newJob$(schedId, jobId, ev$, hub) {    

    let evCount = 0;
    let increment = 0;        

    let buffer = d3.range(100).map(_ => ({val:0, t0: 0, t1: 0}));
    let bufferWindow = createWindowConvolution(buffer.length);

    ev$.subscribe(_ => increment++);

    let now = Date.now();
    let last = 0;
    const spec = {
        height: 80,
        scale: 3,
        plots: [
            {
                name: 'precise',
                colour: 'blue',
                scale: 20,
                getValue: () => {            
                    let v = increment;
                    evCount += increment;

                    last = now;
                    now = Date.now();

                    buffer.push({
                        t0: last,
                        t1: now,
                        val: increment
                    });

                    buffer.shift();
                    increment = 0;

                    return v;
                }
            },        
            {
                name: 'smooth',
                colour: 'purple',
                scale: 5,
                getValue: () => {                       
                    //in ms below, convert to secs last
                    let hits = buffer.reduce((ac, d) => ac + ((d.val / (d.t1 - d.t0)) || 0), 0);
                    let samples = buffer.length;
                    let hz = (hits / samples) * 1000;

                    document.getElementById(`overall_${jobId}`).value = `${hz.toFixed(2)} Hz`;

                    return hz * 0.2;
                }
            }
        ]
    };


    const change = (a, b) => {
        let v = a.target.value - 50;
        let weight = Math.pow(1.07, v);
        hub.invoke('updateJob', schedId, jobId, weight);

        document.getElementById(`weight_out_${jobId}`).value = weight.toFixed(2);
    }

    const remove = (a, b) => {
        hub.invoke('updateJob', schedId, jobId, 0);
    }

    const render = () => {
        return <div>		
					<div className="job-controls">					
						<div className="weight-controls">						
								<label htmlFor={`weight_in_${jobId}`}>Weight</label>
								<input type="range" onChange={change} id={`weight_in_${jobId}`}/>
								<output htmlFor={`weight_in_${jobId}`} id={`weight_out_${jobId}`}>1.00</output>
								<button onClick={remove}>Remove</button>							
							</div>						
						<JobGraph spec={spec}/>				
                                             
                        <div> 
                            <label htmlFor={'overall_' + jobId}>Rate</label>
                            <output id={'overall_' + jobId}>123</output> 
                        </div>		
					</div>
                </div>;
    };

    return ev$.map(x => ({ id:jobId, el:render() }));
}





function createWindowConvolution(l) {
    let scaler = Math.pow(2 * Math.PI, 1/3);

    let fnWindow = x => 0.5 * 
                            ( Math.sin( 
                                    Math.pow( (x / l) * scaler, 3)  - (Math.PI / 2)) 
                                    + 1 ); 

    let d = d3.range(l).map(fnWindow);

    return d;
}


function newScheduler$(schedId, ev$, hub) {

    let addJob = () => {
        hub.invoke('updateJob', schedId, Guid.raw(), 1);
    };

    let setLimit = (e) => {
        let v = e.target.value - 50;
        let limit = Math.pow(1.05, v) * 3;
        
        document.getElementById('hz_out_' + schedId).value = limit.toFixed(2) + ' Hz';

        hub.invoke('setOverallLimit', schedId, limit);
    }

    let evCount = 0;
    let increment = 0;        

    let buffer = d3.range(100).map(_ => ({val:0, t0: 0, t1: 0}));
    let bufferWindow = createWindowConvolution(buffer.length);

    ev$.subscribe(_ => increment++);

    let now = Date.now();
    let last = 0;

    const spec = {
        height: 140,
        scale: 3,
        plots: [
            {
                name: 'precise',
                colour: 'blue',
                scale: 20,
                getValue: () => {             
                    let v = increment;
                    evCount += increment;

                    last = now;
                    now = Date.now();

                    buffer.push({
                        t0: last,
                        t1: now,
                        val: increment
                    });

                    buffer.shift();
                    increment = 0;

                    return v;
                }
            },        
            {
                name: 'smooth',
                colour: 'purple',
                scale: 5,
                getValue: () => {   
                    //in ms below, convert to secs last
                    let hits = buffer.reduce((ac, d) => ac + ((d.val / (d.t1 - d.t0)) || 0), 0);
                    let samples = buffer.length;

                    //each sample value should be scaled by the window function
                    //we'd therefore need to integrate the function



                    // let hits = wu.zipWith((a,b) => a.val*b, buffer, bufferWindow).reduce((a,b) => a+b);
                    // let area = wu(bufferWindow).reduce((a,b) => a+b);

                    let hz = (hits / samples) * 1000;

                    document.getElementById(`overall_${schedId}`).value = `${hz.toFixed(2)} Hz`;

                    return hz * 0.2;
                }
            }
        ]
    };


    return ev$.groupBy(ev => ev.jobId)
                .flatMap((group, i) => newJob$(schedId, group.key, group, hub))
                .scan((jobs, job) => { jobs.set(job.id, job.el); return jobs; }, new Map())
                .map(jobs => Array.from(jobs)
                                    .map(([k, v]) => <tr key={k}><td>{v}</td></tr>) )
                .map(jobEls => ({ 
                                  id: schedId, 
                                  el: <div>
                                          <table>
                                                <tbody>
													<tr>
												
														<th>
		
															<div className="scheduler-controls">
																<h3>Overall</h3>
																
																<div className="weight-controls">
																	<label htmlFor={'hz_out_' + schedId}>Limit</label>
																	<input type="range" onChange={setLimit} id={'hz_in_' + schedId}/>
																	<output htmlFor={'hz_in_' + schedId} id={'hz_out_' + schedId}></output>

																	<button onClick={addJob}>Add Job</button>
																</div>
																
																<JobGraph spec={spec}/>
																                                                        
                                                                <div> 
                                                                    <label htmlFor={'overall_' + schedId}>Rate</label>
                                                                    <output id={'overall_' + schedId}>123</output> 
                                                                </div>

															</div>
														</th>
													</tr>
                                                { jobEls }
                                                </tbody>
                                          </table>
                                      </div> 
                              }));
}




function newApp$(ev$, hub) {
    return ev$
            .groupBy(ev => ev.schedId)               
            .flatMap((group, i) => newScheduler$(group.key, group, hub))
            .scan((scheds, sched) => { scheds.set(sched.id, sched.el); return scheds; }, new Map())    
            .map(scheds => Array.from(wu(scheds.entries()).map(([k, v]) => <section key={k}>{v}</section>)))
            .map(els => <div>{els}</div>);
                
}


export default newApp$;
