import React from 'react';

import sharedTheme from '../../styling/theme.js';
import FormControl from '@material-ui/core/FormControl';
import Select from 'react-select';
import Button from '@material-ui/core/Button';
import { Icon } from '@twilio/flex-ui';
import { withStyles } from '@material-ui/core/styles';
import { makeInternalCall } from './index';
import { debounce } from 'lodash';

const styles = (theme) => sharedTheme(theme);
function compare(a, b) {
  return a.label > b.label ? 1 : b.label > a.label ? -1 : 0;
}
class InternalDialQueue extends React.Component {
  state = {
    queueList: [],
    selectedQueue: null,
    workerList: [],
    selectedWorker: null,
    inputText: '',
    reservationList: [],
  };

  async componentDidMount() {
    this.setQueues();
    this.setReservations();
  }

  setQueues = (query = '') => {
    this.props.manager.insightsClient.instantQuery('tr-queue').then((q) => {
      q.on('searchResult', (items) => {
        this.setState({
          queueList: Object.keys(items).map((queueSid) => items[queueSid]),
        });
      });

      q.search('');
    });
  };

  setReservations = () => {
    this.props.manager.insightsClient
      .instantQuery('tr-reservation')
      .then((q) => {
        q.on('searchResult', async (items) => {
          this.setState({
            reservationList: Object.keys(items).map(
              (sid) => items[sid].worker_sid
            ),
          });
        });
        //q.search('');
        q.search(
          `data.task_status == "reserved" || data.task_status == "assigned" || data.task_status == "wrapping"`
        );
      });
  };

  setWorkers = (selectedQueue) => {
    let queue = selectedQueue.value;

    const {
      contact_uri: worker_contact_uri,
    } = this.props.manager.workerClient.attributes;

    this.props.manager.insightsClient.instantQuery('tr-worker').then((q) => {
      q.on('searchResult', async (items) => {
        const workers = await Object.keys(items).map(
          (workerSid) => items[workerSid]
        );
        this.setState({
          workerList: [...workers],
        });
      });
      q.search(
        `data.attributes.contact_uri != "${worker_contact_uri}" AND data.worker_sid NOT_IN "${this.state.reservationList}"`
      );
    });
  };

  handleQueueChange = (event) => {
    this.setState({ selectedQueue: event });
    this.setReservations();
    this.setWorkers(event);
  };

  handleWorkerChange = (event) => {
    this.setState({ selectedWorker: event });
  };

  handleInputChange = (event) => {
    this.setState({ inputText: event });
    //this.handleQueuesListUpdate(event);
    this.handleWorkersListUpdate(event);

    if (event !== '') {
      this.setState({ selectedWorker: null });
    }
  };

  handleWorkersListUpdate = debounce(
    (e) => {
      if (e) {
        this.setWorkers(`data.attributes.full_name CONTAINS "${e}"`);
      }
    },
    250,
    { maxWait: 1000 }
  );

  // handleOnFocus = () => {
  //   if (this.state.inputText === '' && this.state.queueList.length === 0) {
  //     this.setQueues();
  //   }
  // };

  makeCall = () => {
    if (this.state.selectedWorker != null) {
      const { manager } = this.props;

      makeInternalCall({
        manager,
        selectedWorker: this.state.selectedWorker.value,
        workerList: this.state.workerList,
      });
    }
  };

  render() {
    const { classes } = this.props;

    const queues = this.state.queueList
      .map((queue) => {
        const { queue_name } = queue;

        return { label: queue_name, value: queue_name };
      })
      .filter((elem) => elem)
      .sort(compare);

    const workers = this.state.workerList
      .map((worker) => {
        const { activity_name } = worker;
        const { contact_uri, full_name } = worker.attributes;

        return activity_name !== 'Offline' &&
          worker.attributes.routing?.skills.includes(
            this.state.selectedQueue.value
          )
          ? { label: full_name, value: contact_uri }
          : null;
      })
      .filter((elem) => elem)
      .sort(compare);

    return (
      <div className={classes.boxDialQueue}>
        <div className={classes.titleAgentDialpad}>Call Agent By Queue</div>
        <div className={classes.subtitleDialpad}>Select Queue</div>
        <FormControl className={classes.formControl}>
          <Select
            className="basic-single"
            classNamePrefix="select"
            isSearchable={true}
            name="queues"
            maxMenuHeight={150}
            onChange={this.handleQueueChange}
            onInputChange={this.handleInputChange}
            onMenuOpen={this.handleOnFocus}
            options={queues}
            value={this.state.selectedQueue || null}
          />
          {this.state.selectedQueue && (
            <React.Fragment>
              <Select
                className="basic-single"
                classNamePrefix="select"
                isSearchable={true}
                name="workers"
                maxMenuHeight={150}
                onChange={this.handleWorkerChange}
                onInputChange={this.handleInputChange}
                onMenuOpen={this.handleOnFocus}
                options={workers}
                inputValue={this.state.inputText}
                value={this.state.selectedWorker || null}
              />
              {this.state.selectedWorker && (
                <div className={classes.buttonAgentDialpad}>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={!this.state.selectedWorker}
                    onClick={this.makeCall}
                    className={classes.dialPadBtn}
                  >
                    <Icon icon="Call" />
                  </Button>
                </div>
              )}
            </React.Fragment>
          )}
        </FormControl>
      </div>
    );
  }
}

export default withStyles(styles)(InternalDialQueue);
