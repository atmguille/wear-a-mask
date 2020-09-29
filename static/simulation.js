const MINIMUM_DISTANCE = 1;
const BOOTSTRAP_SMALL_WINDOW_WIDTH = 576;  // 'sm' size for Bootstrap, used on window resize
let SPEED = 0;
let MASKS = 0;
let INFECTED = 0;
let EPOCH = 0;
let STOP = false;

const LEFT_INIT = 30;
const TOP_INIT = 0;
const PADDING = 30;

let POPULATION = [];

// Variables that should be STATIC (but cannot be declared as such to avoid problems with Safari)
const MOVE_TYPES = ["Stay", "Up", "Down", "Left", "Right", "Up-Left", "Up-Right", "Down-Left", "Down-Right"];
let MOVE_LOCATION_INDEXES = [];
let MOVE_MAP_SIZE;
let PERSON__id = 0;
const PERSON_PROBABILITIES = new Map()  // (infected wearing mask, to_infect wearing_mask)
    .set('[false, false]', 0.9)
    .set('[false, true]', 0.7)
    .set('[true, false]', 0.05)
    .set('[true, true]', 0.015);
const PERSON_EMOJIS = new Map()  // (is_infected, wearing_mask)
    .set('[false, false]', '<i class="em em-confused"></i>')
    .set('[false, true]', '<i class="em em-mask"></i>')
    .set('[true, false]', '<i class="em em-face_with_thermometer ill-filter"></i>')
    .set('[true, true]', '<i class="em em-mask ill-filter"></i>');

document.addEventListener('DOMContentLoaded', () => {
    const board_size = document.querySelector('#board-size');
    const n_persons = document.querySelector('#n-persons');
    const infected_percentage = document.querySelector('#infected-percentage');
    const masks_percentage = document.querySelector('#masks-percentage');
    const speed = document.querySelector('#speed');
    const play_stop = document.querySelector('.play-stop-button');

    function update_variables(update_size, update_infected, update_masks) {
        if (update_size) {
            MOVE_MAP_SIZE = parseInt(board_size.value);
            n_persons.max = Math.pow(board_size.value, 2);
            n_persons.value = Math.min(n_persons.value, n_persons.max).toString();
        }
        if (update_infected) {
            INFECTED = Math.floor(n_persons.value * infected_percentage.value);
            document.querySelector('#infected_count').innerHTML = INFECTED.toString();
        }
        if (update_masks) {
            MASKS = Math.floor(n_persons.value * masks_percentage.value);
            document.querySelector('#masks_count').innerHTML = MASKS.toString();
        }

        STOP = true;
        EPOCH = 0;
        document.querySelector('#epoch_count').innerHTML = EPOCH.toString();

        init(parseInt(board_size.value), parseInt(n_persons.value), INFECTED, MASKS);

    }

    function resize_board_to_max() {
        // As defined in the html file, if window is larger than small (sm), board occupies half of the space (divisor = 2)
        let divisor = 1;
        if (window.innerWidth >= BOOTSTRAP_SMALL_WINDOW_WIDTH) {
            divisor = 2;
        }

        // board_size.max * PADDING = innerWidth/divisor - 2*Left (Left is a small padding)
        board_size.max = Math.floor((window.innerWidth/divisor - 2*LEFT_INIT) / PADDING);

        if (parseInt(board_size.value) > board_size.max) {
            board_size.value = board_size.max;
            update_variables(true, true, true);
        }
    }

    update_variables(true, true, true);
    resize_board_to_max();

    window.addEventListener('resize', resize_board_to_max);

    document.querySelectorAll('.modifiable-input').forEach(input => {
        input.onchange = event => {
            const id = event.target.id;
            const value = parseInt(event.target.value);
            const min = parseInt(event.target.min);
            const max = parseInt(event.target.max);

            // Before updating, check value is in range
            if (min <= value && value <= max) {
                if (id === "board-size") update_variables(true,true,true);
                else if (id === "n-persons") update_variables(false,true,true);
                else if (id === "infected-percentage") update_variables(false,true,false);
                else if (id === "masks-percentage") update_variables(false, false, true);
            }
        }
    });

    play_stop.onclick = () => {
        if (play_stop.id === "play") {  // ids instead of innerHTML is used to avoid problems with translations
            SPEED = parseFloat(document.querySelector('#speed').value) * 1000;  // in ms
            board_size.readOnly = true;
            n_persons.readOnly = true;
            infected_percentage.readOnly = true;
            masks_percentage.readOnly = true;
            speed.readOnly = true;
            STOP = false;
            play_stop.id = "stop";
            play_stop.innerHTML = "Stop";
            simulation(parseInt(n_persons.value)).then(async (finished) => {
                await new Promise(r => setTimeout(r, SPEED));  // Wait for final move
                play_stop.id = "play";
                board_size.readOnly = false;
                n_persons.readOnly = false;
                infected_percentage.readOnly = false;
                masks_percentage.readOnly = false;
                speed.readOnly = false;
                if (finished) {  // Infection finished
                    alert("POPULATION TOTALLY INFECTED. By clicking accept, board will be reinitialized");
                    update_variables(false, true, false);
                    play_stop.innerHTML = "Play!";
                } else {  // Infection stopped
                    play_stop.innerHTML = "Restart";
                }
            });
        } else if (play_stop.id === "stop") {
            STOP = true;
            play_stop.innerHTML = "Stopping...";
        }
        return false;  // Avoid form to be submitted
    };
})


function to_absolute_px_x(x) {
    return `${LEFT_INIT + PADDING*x}px`;
}

function to_absolute_px_y(y) {
    return `${TOP_INIT + PADDING*y}px`;
}


class Move {

    constructor(x_init, y_init, move_type) {
        this.x_init = x_init;
        this.x_dest = x_init;
        this.y_init = y_init;
        this.y_dest = y_init;
        if (move_type.includes("Up")) {
            this.y_dest--;
        }
        if (move_type.includes("Down")) {
            this.y_dest++;
        }
        if (move_type.includes("Left")) {
            this.x_dest--;
        }
        if (move_type.includes("Right")) {
            this.x_dest++;
        }
    }

    is_stay() {
        return this.x_init === this.x_dest && this.y_init === this.y_dest;
    }

    in_map() {
        return 0 <= this.x_dest && this.x_dest < MOVE_MAP_SIZE && 0 <= this.y_dest && this.y_dest < MOVE_MAP_SIZE;
    }

    to_free_pos() {
        // Note: includes will not work due to inconsistencies with array comparison (that's why JSON is used to compare them)
        return !MOVE_LOCATION_INDEXES.some(item => JSON.stringify(item) === JSON.stringify([this.x_dest, this.y_dest]));
    }

    is_valid() {
        return this.is_stay() || (this.in_map() && this.to_free_pos());
    }

    update_indexes() {
        if (!this.is_stay()) {
            // 'remove' method does not exist. Also, array comparison has inconsistencies. That's why JSON is used to compare them
            MOVE_LOCATION_INDEXES = MOVE_LOCATION_INDEXES.filter((item, index, arr) =>
                JSON.stringify(item) !== JSON.stringify([this.x_init, this.y_init]));
            MOVE_LOCATION_INDEXES.push([this.x_dest, this.y_dest]);
        }
    }
}

class Person {

    constructor(x, y, infected, mask) {
        this.id = PERSON__id++;
        this.x = x;
        this.y = y;
        this.is_infected = infected;
        this.wearing_mask = mask;
    }

    get emoji() {
        return PERSON_EMOJIS.get(`[${this.is_infected}, ${this.wearing_mask}]`);
    }

    is_close(other) {
        return Math.abs(this.x - other.x) <= MINIMUM_DISTANCE && Math.abs(this.y - other.y) <= MINIMUM_DISTANCE;
    }

    set_infected() {
        this.is_infected = true;
        document.querySelector(`#person-${this.id}`).innerHTML = this.emoji;
    }

    should_infect(to_infect) {
        const probability = PERSON_PROBABILITIES.get(`[${this.wearing_mask}, ${to_infect.wearing_mask}]`);
        return Math.random() < probability;
    }

    static check_infection(person1, person2) {
        if(!person1.is_close(person2) || (person1.is_infected && person2.is_infected) ||
            (!person1.is_infected && !person2.is_infected)) {
            return [false, false];
        }

        if (person1.is_infected && person1.should_infect(person2)) {
            return [false, true];
        } else if (person2.is_infected && person2.should_infect(person1)) {
            return [true, false];
        } else {
            return [false, false];
        }
    }

    move() {
        const move_types = _.shuffle(MOVE_TYPES);
        for (const move_type of move_types) {
            let move = new Move(this.x, this.y, move_type);
            if (move.is_valid()) {
                move.update_indexes();

                const person = document.querySelector(`#person-${this.id}`);
                person.animate({
                    left: [to_absolute_px_x(this.x), to_absolute_px_x(move.x_dest)],
                    top: [to_absolute_px_y(this.y), to_absolute_px_y(move.y_dest)]
                }, SPEED);

                person.style.left = to_absolute_px_x(move.x_dest);
                person.style.top = to_absolute_px_y(move.y_dest);
                this.x = move.x_dest;
                this.y = move.y_dest;
                break;
            }
        }
    }
}

function population_init(board_size, n_persons, infected, masks) {
    const total_indexes = [];
    for (const i of Array(board_size).keys()) {
        for (const j of Array(board_size).keys()) {
            total_indexes.push([i, j]);
        }
    }

    MOVE_LOCATION_INDEXES = _.sampleSize(total_indexes, n_persons);

    const infected_indexes = _.shuffle(Array(...Array(infected)).map(() => true)
        .concat(Array(...Array(n_persons - infected)).map(() => false)));
    const masks_indexes = _.shuffle(Array(...Array(masks)).map(() => true)
        .concat(Array(...Array(n_persons - masks)).map(() => false)));

    const population = [];
    _.zip(MOVE_LOCATION_INDEXES, infected_indexes, masks_indexes).forEach(element => {
        const location = element[0];
        const is_infected = element[1];
        const wearing_mask = element[2];
        population.push(new Person(location[0], location[1], is_infected, wearing_mask));
    });
    return population;
}


function board_init(population) {
    const board = document.querySelector('#board');
    // Remove previous display
    while (board.firstChild) {
        board.removeChild(board.firstChild);
    }

    for (const person of population) {
        const span = document.createElement('span');
        span.id = `person-${person.id}`;
        span.style.position = 'absolute';
        span.innerHTML = person.emoji;
        span.style.left = to_absolute_px_x(person.x);
        span.style.top = to_absolute_px_y(person.y);
        board.appendChild(span);
    }
    const rectangle = document.querySelector('#rectangle');
    rectangle.style.position = 'absolute';
    rectangle.style.left = `${LEFT_INIT}px`;
    rectangle.style.top = `${TOP_INIT}px`;
    rectangle.style.height = `${MOVE_MAP_SIZE * PADDING}px`;
    rectangle.style.width = `${MOVE_MAP_SIZE * PADDING}px`;
    rectangle.style.border = "1px solid #000";
}

function init(board_size, n_persons, infected, masks) {
    POPULATION = population_init(board_size, n_persons, infected, masks);
    board_init(POPULATION);
}


async function simulation(n_persons) {

    while (INFECTED < n_persons && !STOP) {
        await new Promise(r => setTimeout(r, SPEED));

        // Infection update will be done after checking infections among all the population
        // This is done to avoid one person getting infected and infecting another at the
        // same moment due to loop order
        let should_update = Array(...Array(n_persons)).map(() => false);
        for (let i = 0; i < n_persons - 1; i++) {
            for (let j = i + 1; j < n_persons; j++) {
                const person1 = POPULATION[i];
                const person2 = POPULATION[j];
                const infection_result = Person.check_infection(person1, person2);
                should_update[person1.id] = should_update[person1.id] || infection_result[0];
                should_update[person2.id] = should_update[person2.id] || infection_result[1];
            }
        }


        POPULATION = _.shuffle(POPULATION);
        for (let person of POPULATION) {
            if (should_update[person.id]) {
                INFECTED++;
                person.set_infected();
            }
            person.move();
        }
        document.querySelector('#infected_count').innerHTML = `${INFECTED}`;
        document.querySelector('#epoch_count').innerHTML = `${EPOCH++}`;
    }
    return INFECTED === n_persons;  // So the caller knows if infection is finished or stopped
}