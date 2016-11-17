using Microsoft.Owin.Hosting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace myday.scheduler.demo
{
    public static class Program
    {

        public static void Main(string[] args) 
        {
            var url = @"http://localhost:9595";

            Console.WriteLine($"Listening at {url}");

            WebApp.Start<Startup>(url);
            
            Console.ReadLine();

        }

    }
}