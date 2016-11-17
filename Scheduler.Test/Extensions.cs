using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace myday.scheduler.test
{
    public static class Extensions
    {
        public static IEnumerable<T> Shuffle<T>(this IEnumerable<T> @this) {
            var rand = new Random();

            var front = new List<T>();
            var back = new List<T>();

            foreach(var item in @this) {
                if(rand.Next(2) == 1) front.Add(item);
                else back.Add(item);
            }

            return front.Reverse<T>().Concat(back);
        }
    }

}
