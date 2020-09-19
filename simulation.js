const MAP_SIZE = 10;
const MINIMUM_DISTANCE = 1;
const N_PERSONS = 100;
const INFECTED_PERCENTAGE = 0.2;
const MASKS_PERCENTAGE = 0.5;
const MASKS = Math.floor(N_PERSONS * MASKS_PERCENTAGE);
let INFECTED = Math.floor(N_PERSONS * INFECTED_PERCENTAGE);

class Move {
    static TYPES = ["Stay", "Up", "Down", "Left", "Right", "Up-Left", "Up-Right", "Down-Left", "Down-Right"];
    static LOCATION_INDEXES = []

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
        return 0 <= this.x_dest && this.x_dest < MAP_SIZE && 0 <= this.y_dest && this.y_dest < MAP_SIZE;
    }

    to_free_pos() {
        // Note: includes will not work due to inconsistencies with array comparison (that's why JSON is used to compare them)
        return !Move.LOCATION_INDEXES.some(item => JSON.stringify(item) === JSON.stringify([this.x_dest, this.y_dest]));
    }

    is_valid() {
        return this.is_stay() || (this.in_map() && this.to_free_pos());
    }

    update_indexes() {
        if (!this.is_stay()) {
            // 'remove' method does not exist. Also, array comparison has inconsistencies. That's why JSON is used to compare them
            Move.LOCATION_INDEXES = Move.LOCATION_INDEXES.filter((item, index, arr) =>
                JSON.stringify(item) !== JSON.stringify([this.x_init, this.y_init]));
            Move.LOCATION_INDEXES.push([this.x_dest, this.y_dest]);
        }
    }
}

class Person {
    static __id = 0;
    static PROBABILITIES = new Map()
        .set('[false, false]', 0.9)
        .set('[false, true]', 0.7)
        .set('[true, false]', 0.05)
        .set('[true, true]', 0.015);

    constructor(x, y, infected, mask) {
        this.id = Person.__id++;
        this.x = x;
        this.y = y;
        this.is_infected = infected;
        this.wearing_mask = mask;
    }

    is_close(other) {
        return Math.abs(this.x - other.x) <= MINIMUM_DISTANCE && Math.abs(this.y - other.y) <= MINIMUM_DISTANCE;
    }

    should_infect(to_infect) {
        const probability = Person.PROBABILITIES.get(`[${this.wearing_mask}, ${to_infect.wearing_mask}]`);
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
        const move_types = _.shuffle(Move.TYPES);
        for (const move_type of move_types) {
            let move = new Move(this.x, this.y, move_type);
            if (move.is_valid()) {
                move.update_indexes();
                this.x = move.x_dest;
                this.y = move.y_dest;
                break;
            }
        }
    }
}

function population_init() {
    const total_indexes = [];
    for (const i of Array(MAP_SIZE).keys()) {
        for (const j of Array(MAP_SIZE).keys()) {
            total_indexes.push([i, j])
        }
    }
    Move.LOCATION_INDEXES = _.sampleSize(total_indexes, N_PERSONS);

    const infected_indexes = _.shuffle(Array(...Array(INFECTED)).map(() => true)
        .concat(Array(...Array(N_PERSONS - INFECTED)).map(() => false)));
    const masks_indexes = _.shuffle(Array(...Array(MASKS)).map(() => true)
        .concat(Array(...Array(N_PERSONS - MASKS)).map(() => false)));

    const population = [];
    _.zip(Move.LOCATION_INDEXES, infected_indexes, masks_indexes).forEach(element => {
        const location = element[0];
        const infected = element[1];
        const mask = element[2];
        population.push(new Person(location[0], location[1], infected, mask));
    });
    return population;
}

function simulation() {
    let population = population_init();

    while (INFECTED < N_PERSONS) {
        let should_update = Array(...Array(N_PERSONS)).map(() => false);

        for (let i = 0; i < N_PERSONS-1; i++) {
            for (let j = i+1; j < N_PERSONS; j++) {
                const person1 = population[i];
                const person2 = population[j];
                const infection_result = Person.check_infection(person1, person2);
                should_update[person1.id] = should_update[person1.id] || infection_result[0];
                should_update[person2.id] = should_update[person2.id] || infection_result[1];
            }
        }



        population = _.shuffle(population);
        for (let person of population) {
            if (should_update[person.id]) {
                INFECTED++;
                person.is_infected = true;
            }
            person.move();
        }

        console.log(`Total INFECTED: ${INFECTED}`);
    }
}