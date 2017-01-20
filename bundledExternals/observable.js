import { Observable } from 'rxjs-es/Observable';
import 'rxjs-es/add/operator/map';
import 'rxjs-es/add/operator/concat';
import 'rxjs-es/add/operator/scan';
import { from } from 'rxjs-es/observable/from';
Observable.from = from; // To make it ES-observable compliant.

export { Observable };
